import { createAdminClient } from '../supabase/admin'
import { planCoverage } from '../pipeline/coverage'
import { generateCandidates, type CandidateWithContext } from '../pipeline/generate'
import { runL1, findVerbatimRange } from '../pipeline/l1'
import { runL2, runL3 } from '../pipeline/validate'
import { dedupeBatch } from '../pipeline/dedupe'
import { selectFinal } from '../pipeline/selection'
import { JOBS, PIPELINE, type ExtractionStage, type QuestionType, type ValidationLayer } from '../constants'
import type { DocumentChunk } from '../types'
import type { GenerateJobPayload } from './queue'

/**
 * The generate-questions job, run inside the worker (NOT a web request -
 * PRD 13.2). This is the full Phase 3 pipeline (PRD 13.1):
 *
 *   planCoverage -> generate (over-generate) -> L1 -> L2 -> L3 -> L4 dedupe
 *   -> selection -> store questions + rejections
 *
 * A question is stored ONLY if it passes every layer (PRD 18.1); each
 * rejection is logged to rejected_questions with its failing layer + reason
 * (quality metrics, PRD 37). Idempotent: re-running deletes this reviewer's
 * prior questions/rejections first, so a retry never duplicates (PRD 13.2).
 */

interface ValidatedItem {
  item: CandidateWithContext
  charStart: number
  charEnd: number
}

export async function handleGenerateQuestions(data: GenerateJobPayload): Promise<void> {
  const supabase = createAdminClient()

  const { data: reviewer } = await supabase
    .from('reviewers')
    .select('id, name, status, mode, requested_question_count, question_types, difficulty')
    .eq('id', data.reviewerId)
    .maybeSingle()
  if (!reviewer) return // deleted mid-flight (hard-delete cascade) -> nothing to do
  // Already generated => skip (protects against retry/double-enqueue).
  if (reviewer.status === 'ready') return
  // Deck-mode reviewers deliver cards, not questions: never spend on a
  // generation job for one, even if a stale enqueue slips through.
  if (reviewer.mode === 'flashcards_only') return

  // --- PLAN COVERAGE -------------------------------------------------------
  await setGenStage(supabase, data.reviewerId, 'planning', 'generating')

  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('reviewer_id', data.reviewerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!doc) {
    await failGen(supabase, data.reviewerId, 'no_document', 'No source document was found for this reviewer.')
    return
  }

  const { data: chunkRows } = await supabase
    .from('document_chunks')
    .select('id, document_id, chunk_index, page_number, section_title, paragraph_index, char_start, char_end, content, created_at')
    .eq('document_id', doc.id)
    .order('chunk_index', { ascending: true })
  const chunks = (chunkRows ?? []) as DocumentChunk[]
  if (chunks.length === 0) {
    await failGen(supabase, data.reviewerId, 'no_content', 'We could not find usable content to generate from.')
    return
  }

  const requested = Math.min(reviewer.requested_question_count, PIPELINE.MAX_CANDIDATES_TOTAL)
  const tasks = planCoverage(
    chunks,
    requested,
    reviewer.question_types as QuestionType[],
    reviewer.difficulty as 'easy' | 'medium' | 'hard' | 'mixed',
  )

  // --- GENERATE (over-generate) -------------------------------------------
  await setGenStage(supabase, data.reviewerId, 'generating', 'generating')
  const { candidates } = await generateCandidates(tasks)
  if (candidates.length === 0) {
    await failGen(
      supabase,
      data.reviewerId,
      'generation_empty',
      'We could not generate any reliable questions from this material. It may be too short or unclear.',
    )
    return
  }

  // --- VALIDATE: L1 -> L2 -> L3 (store rejections with layer + reason) -----
  await setGenStage(supabase, data.reviewerId, 'validating', 'validating')
  const rejections: { candidate: CandidateWithContext['candidate']; failed_layer: ValidationLayer; reason: string }[] = []

  // L1 is pure and instant: sweep every candidate first so only survivors
  // pay for model calls.
  const survivors: { index: number; item: CandidateWithContext; charStart: number; charEnd: number }[] = []
  candidates.forEach((item, index) => {
    const l1 = runL1(item)
    if (!l1.pass) {
      rejections.push({ candidate: item.candidate, failed_layer: 'L1_deterministic', reason: l1.reason })
    } else {
      survivors.push({ index, item, charStart: l1.charStart, charEnd: l1.charEnd })
    }
  })

  // L2 -> L3 chains run concurrently across candidates (bounded), but each
  // candidate still clears BOTH layers before it counts (PRD 18.1). Writing
  // into positional slots keeps `validated` in coverage-plan order.
  const validatedSlots: (ValidatedItem | undefined)[] = new Array(candidates.length)
  let cursor = 0
  const validateWorker = async () => {
    while (cursor < survivors.length) {
      const s = survivors[cursor++]
      const l2 = await runL2(s.item)
      if (!l2.pass) {
        rejections.push({ candidate: s.item.candidate, failed_layer: 'L2_closed_evidence', reason: l2.reason })
        continue
      }
      const l3 = await runL3(s.item)
      if (!l3.pass) {
        rejections.push({ candidate: s.item.candidate, failed_layer: 'L3_judge', reason: l3.reason })
        continue
      }
      validatedSlots[s.index] = { item: s.item, charStart: s.charStart, charEnd: s.charEnd }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(PIPELINE.VALIDATION_CONCURRENCY, survivors.length) }, validateWorker),
  )
  const validated: ValidatedItem[] = validatedSlots.filter((v): v is ValidatedItem => v !== undefined)

  // --- DEDUPLICATE (L4) + SELECT ------------------------------------------
  await setGenStage(supabase, data.reviewerId, 'selecting', 'validating')
  const { kept } = dedupeBatch(validated.map((v) => v.item))
  const keptSet = new Set(kept.map((k) => k.candidate))
  const keptValidated = validated.filter((v) => keptSet.has(v.item.candidate))
  const dedupedOut = validated.length - keptValidated.length
  if (dedupedOut > 0) {
    for (const v of validated) {
      if (!keptSet.has(v.item.candidate)) {
        rejections.push({ candidate: v.item.candidate, failed_layer: 'L4_deduplication', reason: 'L4: near-duplicate of an accepted question.' })
      }
    }
  }

  const { selected, belowMinimum } = selectFinal(
    keptValidated.map((v) => v.item),
    requested,
    reviewer.question_types as QuestionType[],
    reviewer.difficulty as 'easy' | 'medium' | 'hard' | 'mixed',
  )

  // Quality metrics (PRD 37): the funnel per layer, always visible in the
  // worker log so silent attrition is diagnosable without a DB round-trip.
  const byLayer = (layer: ValidationLayer) => rejections.filter((r) => r.failed_layer === layer).length
  console.log(
    `[generate] funnel: candidates=${candidates.length} ` +
      `L1_fail=${byLayer('L1_deterministic')} L2_fail=${byLayer('L2_closed_evidence')} ` +
      `L3_fail=${byLayer('L3_judge')} L4_dup=${byLayer('L4_deduplication')} ` +
      `selected=${selected.length} belowMinimum=${belowMinimum} reviewer=${data.reviewerId}`,
  )

  // Persist every rejection (PRD 18.1: needed for quality metrics).
  if (rejections.length > 0) {
    const { error: rejErr } = await supabase.from('rejected_questions').insert(
      rejections.map((r) => ({
        reviewer_id: data.reviewerId,
        candidate: r.candidate as never,
        failed_layer: r.failed_layer,
        reason: r.reason.slice(0, 1000),
      })),
    )
    if (rejErr) console.error(`[generate] rejection logging failed: ${rejErr.message}`)
  }

  // --- Honest outcome (PRD 25: never fabricate to hit the count) -----------
  if (belowMinimum || selected.length === 0) {
    await failGen(
      supabase,
      data.reviewerId,
      'below_minimum',
      `We could only reliably generate ${selected.length} question(s) from this material — below the minimum of ${PIPELINE.MIN_VIABLE_QUESTIONS} for a useful reviewer. Try uploading more content.`,
    )
    return
  }

  await storeQuestions(supabase, data.reviewerId, selected)

  const { error: rErr } = await supabase
    .from('reviewers')
    .update({ status: 'ready', question_count: selected.length })
    .eq('id', data.reviewerId)
  if (rErr) throw new Error(`Reviewer update failed: ${rErr.message}`)

  await supabase
    .from('generation_jobs')
    .update({ status: 'completed', stage: 'completed', finished_at: new Date().toISOString() })
    .eq('reviewer_id', data.reviewerId)
    .in('status', ['queued', 'running'])

  console.log(
    `[generate] reviewer ${data.reviewerId}: ${selected.length}/${requested} questions stored, ${rejections.length} rejected`,
  )
}

/** Delete-then-insert question rows with full source locators (PRD 14.1/20). */
async function storeQuestions(
  supabase: ReturnType<typeof createAdminClient>,
  reviewerId: string,
  selected: CandidateWithContext[],
): Promise<void> {
  // Idempotent reset (PRD 13.2): a retry must never duplicate questions.
  await supabase.from('questions').delete().eq('reviewer_id', reviewerId)

  const rows = selected.map((item, i) => {
    // Recompute the evidence range against the chunk we hold on the item, so
    // stored char_start/char_end always line up with source_text exactly
    // (PRD 18.1), independent of the option-shuffle copy made in selection.
    const range = findVerbatimRange(item.chunkContent, item.candidate.evidenceQuote)
    return {
      reviewer_id: reviewerId,
      order_index: i,
      type: item.candidate.type,
      question: item.candidate.question,
      // Identification is a typed answer: never store leaked options for it.
      options: item.candidate.type === 'identification' ? [] : item.candidate.options,
      correct_answer: item.candidate.correctAnswer,
      explanation: item.candidate.explanation,
      source_chunk_id: item.chunkId,
      source_page: item.page,
      source_section: item.sectionTitle,
      source_text: item.candidate.evidenceQuote,
      source_char_start: range?.charStart ?? 0,
      source_char_end: range?.charEnd ?? item.candidate.evidenceQuote.length,
      topic: item.candidate.topic,
      difficulty: item.candidate.difficulty,
      version: 1,
    }
  })
  const { error } = await supabase.from('questions').insert(rows)
  if (error) throw new Error(`Question insert failed: ${error.message}`)
}

/** Move reviewer lifecycle status + the active job's real stage (PRD 13.3). */
async function setGenStage(
  supabase: ReturnType<typeof createAdminClient>,
  reviewerId: string,
  stage: ExtractionStage,
  reviewerStatus: 'generating' | 'validating',
): Promise<void> {
  await supabase
    .from('generation_jobs')
    .update({ status: 'running', stage, started_at: new Date().toISOString() })
    .eq('reviewer_id', reviewerId)
    .in('status', ['queued', 'running'])
  await supabase.from('reviewers').update({ status: reviewerStatus }).eq('id', reviewerId)
}

async function failGen(
  supabase: ReturnType<typeof createAdminClient>,
  reviewerId: string,
  code: string,
  message: string,
): Promise<void> {
  await supabase.from('reviewers').update({ status: 'failed' }).eq('id', reviewerId)
  await supabase
    .from('generation_jobs')
    .update({ status: 'failed', stage: 'failed', error_code: code, error_message: message.slice(0, 1000), finished_at: new Date().toISOString() })
    .eq('reviewer_id', reviewerId)
    .in('status', ['queued', 'running'])
}

export const HANDLED_GENERATE_JOB = JOBS.GENERATE_QUESTIONS
