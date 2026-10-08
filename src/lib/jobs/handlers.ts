import { createAdminClient } from '../supabase/admin'
import { processDocumentBytes } from '../extraction'
import { describeExtractionError } from '../extraction/failures'
import { generateFlashcards, type FlashcardChunk } from '../pipeline/flashcards'
import { replaceDeckCards } from '../pipeline/deck-store'
import { JOBS, type ExtractionStage } from '../constants'
import type { ExtractJobPayload } from './queue'

/**
 * The extract-document job handler, run inside the worker process (NOT in a
 * web request - PRD 13.2). Uses the service-role client because the worker is
 * a trusted system actor with no user session; every write is still scoped to
 * the one reviewer/document this job names.
 *
 * Idempotent (PRD 13.2): re-running for an already-extracted document is a
 * no-op, and chunk writes delete-then-insert so retries never duplicate.
 */
export async function handleExtractDocument(data: ExtractJobPayload): Promise<void> {
  const supabase = createAdminClient()

  const { data: doc } = await supabase
    .from('documents')
    .select('id, reviewer_id, file_name, file_type, storage_path, extraction_status')
    .eq('id', data.documentId)
    .maybeSingle()
  // Reviewer/document was deleted before the job ran (hard-delete + rollback,
  // PRD 26.3) -> nothing to do. Return rather than throw so pg-boss does not
  // pointlessly retry an orphan whose rows no longer exist.
  if (!doc) return

  // Already processed => check whether the deliverable still finished. In
  // deck mode a retry that died mid-build must complete the deck; in question
  // mode the extraction job really is done.
  if (doc.extraction_status === 'extracted') {
    const { data: existing } = await supabase
      .from('reviewers')
      .select('mode, status')
      .eq('id', data.reviewerId)
      .maybeSingle()
    if (existing && existing.mode === 'flashcards_only' && existing.status !== 'ready') {
      await buildDeck(supabase, data.reviewerId, doc.id)
    }
    return
  }

  await setStage(supabase, data.reviewerId, 'downloading')

  // 1. Download the original bytes from private storage.
  const { data: file, error: dlErr } = await supabase.storage
    .from('source-documents')
    .download(doc.storage_path)
  if (dlErr || !file) {
    await fail(supabase, data.reviewerId, data.documentId, 'download_failed', 'Could not read the uploaded file.')
    return
  }
  const bytes = new Uint8Array(await file.arrayBuffer())

  // 2. Extract + chunk + quality-score.
  await setStage(supabase, data.reviewerId, 'extracting')
  let processed: Awaited<ReturnType<typeof processDocumentBytes>>
  try {
    processed = await processDocumentBytes(
      { file_name: doc.file_name, file_type: doc.file_type },
      bytes,
    )
  } catch (err) {
    // Map raw parser failures (unsupported content, encrypted PDF, corrupt
    // bytes) into actionable copy — never surface the library's message.
    const mapped = describeExtractionError(err)
    await fail(supabase, data.reviewerId, data.documentId, mapped.code, mapped.message)
    return
  }

  // 3. Quality gate (PRD 15.1): block generation on unreadable text.
  await setStage(supabase, data.reviewerId, 'quality_check')
  if (!processed.quality.passed) {
    await fail(supabase, data.reviewerId, data.documentId, 'low_quality_text',
      processed.quality.reason ?? 'Not enough usable text was extracted.')
    return
  }

  // 4. Store chunks - delete first for idempotency, then insert (PRD 13.2).
  await setStage(supabase, data.reviewerId, 'structuring')
  await supabase.from('document_chunks').delete().eq('document_id', doc.id)
  if (processed.chunks.length > 0) {
    const rows = processed.chunks.map((c) => ({
      document_id: doc.id,
      ...c,
    }))
    // Batch insert to stay under Supabase's per-request payload limits.
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error: insErr } = await supabase.from('document_chunks').insert(rows.slice(i, i + BATCH))
      if (insErr) throw new Error(`Chunk insert failed: ${insErr.message}`)
    }
  }

  // 5. Mark the document extracted with its locators/quality metadata.
  const { error: updErr } = await supabase
    .from('documents')
    .update({
      extraction_status: 'extracted',
      page_count: processed.pageCount,
      text_quality_score: processed.quality.score,
    })
    .eq('id', doc.id)
  if (updErr) throw new Error(`Document update failed: ${updErr.message}`)

  // 6. Branch on what this reviewer delivers (see migration 0004).
  const { data: reviewer } = await supabase
    .from('reviewers')
    .select('id, mode')
    .eq('id', data.reviewerId)
    .maybeSingle()
  // Deleted mid-job (hard-delete cascade, PRD 26.3) -> nothing to write.
  if (!reviewer) return

  if (reviewer.mode === 'flashcards_only') {
    // A deck is the whole deliverable: build it straight from the chunks we
    // just stored, with no verify-before-spend pause (the quality gate above
    // is what protects the AI cost) and no question generation at all.
    await buildDeck(supabase, data.reviewerId, doc.id)
    return
  }

  // Question mode: advance the reviewer to the Verify screen state + close the job.
  await supabase.from('reviewers').update({ status: 'awaiting_verification' }).eq('id', data.reviewerId)
  await supabase
    .from('generation_jobs')
    .update({ status: 'completed', stage: 'completed', finished_at: new Date().toISOString() })
    .eq('reviewer_id', data.reviewerId)
    .eq('status', 'running')
}

/**
 * Deck-mode completion step: chunks -> printable flashcard rows -> 'ready'.
 * Runs in the worker, inside the same extraction job (one upload, one job,
 * one deliverable). Idempotent via replaceDeckCards' delete-then-insert.
 */
async function buildDeck(
  supabase: ReturnType<typeof createAdminClient>,
  reviewerId: string,
  documentId: string,
): Promise<void> {
  await supabase
    .from('generation_jobs')
    .update({ status: 'running', stage: 'generating', started_at: new Date().toISOString() })
    .eq('reviewer_id', reviewerId)
    .in('status', ['queued', 'running'])
  await supabase.from('reviewers').update({ status: 'generating' }).eq('id', reviewerId)

  const { data: chunkRows } = await supabase
    .from('document_chunks')
    .select('id, content, section_title, page_number')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })
  const chunks = (chunkRows ?? []) as FlashcardChunk[]
  if (chunks.length === 0) {
    await failDeck(supabase, reviewerId, 'no_content', 'We could not find usable content to make cards from.')
    return
  }

  const { cards } = await generateFlashcards(chunks)
  if (cards.length === 0) {
    // Honest refusal (PRD 3): every card must be answerable from the material.
    await failDeck(
      supabase,
      reviewerId,
      'deck_empty',
      'We could not build reliable cards from this material - every card must come from your own text, and none cleared that bar. Try a document with more written content.',
    )
    return
  }

  const stored = await replaceDeckCards(reviewerId, cards)
  if (!stored.ok) {
    await failDeck(supabase, reviewerId, 'deck_write_failed', stored.error)
    return
  }

  await supabase.from('reviewers').update({ status: 'ready' }).eq('id', reviewerId)
  await supabase
    .from('generation_jobs')
    .update({ status: 'completed', stage: 'completed', finished_at: new Date().toISOString() })
    .eq('reviewer_id', reviewerId)
    .in('status', ['queued', 'running'])
  console.log(`[worker] deck built for ${reviewerId}: ${stored.count} cards`)
}

/** Move the reviewer status + the active job's stage forward (real progress, PRD 13.3). */
async function setStage(supabase: ReturnType<typeof createAdminClient>, reviewerId: string, stage: ExtractionStage): Promise<void> {
  await supabase
    .from('generation_jobs')
    .update({ status: 'running', stage, started_at: new Date().toISOString() })
    .eq('reviewer_id', reviewerId)
    .in('status', ['queued', 'running'])
  // Map the sub-stage onto the reviewer lifecycle status where it differs.
  const reviewerStatus = stage === 'extracting' || stage === 'downloading' ? 'extracting' : 'structuring'
  await supabase.from('reviewers').update({ status: reviewerStatus }).eq('id', reviewerId)
}

/** Record a terminal failure the user can act on (PRD 29.4). */
async function fail(
  supabase: ReturnType<typeof createAdminClient>,
  reviewerId: string,
  documentId: string,
  code: string,
  message: string,
): Promise<void> {
  await supabase.from('documents').update({ extraction_status: 'failed' }).eq('id', documentId)
  await supabase.from('reviewers').update({ status: 'failed' }).eq('id', reviewerId)
  await supabase
    .from('generation_jobs')
    .update({ status: 'failed', stage: 'failed', error_code: code, error_message: message, finished_at: new Date().toISOString() })
    .eq('reviewer_id', reviewerId)
    .in('status', ['queued', 'running'])
}

/**
 * Deck-build failure. The extraction itself SUCCEEDED, so the document keeps
 * its 'extracted' status - only the reviewer + job record move to failed. If
 * the reviewer was deleted mid-build these are harmless no-ops (RLS-free
 * service-role updates that simply match no rows).
 */
async function failDeck(
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

export const HANDLED_JOB = JOBS.EXTRACT_DOCUMENT
