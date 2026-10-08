import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { REPORT_REASONS, type QuestionType } from '@/lib/constants'
import type { Attempt, AttemptAnswer, DocumentChunk, Question } from '@/lib/types'
import { seededShuffle, hashStringToSeed, combineSeeds } from '@/lib/review/shuffle'
import { summarizeAnswers } from '@/lib/review/scoring'

/**
 * Results and answer-review read models (PRD 22/23/24). These run AFTER an
 * attempt is completed, which is the only time correctness, the correct
 * answer, the explanation and the source evidence may be revealed (PRD 21.2).
 * Every read is RLS-scoped to the signed-in owner; score/percentage come
 * straight from the server-computed attempt row (PRD 26.3) and the
 * correct/incorrect/skipped breakdown is derived here, never in the browser.
 */

export interface AttemptSummary {
  attemptId: string
  reviewerId: string
  reviewerName: string
  total: number
  correct: number
  incorrect: number // includes skipped (PRD 22)
  skipped: number // shown separately when non-zero (PRD 22)
  percentage: number
  completedAt: string | null
}

export interface SourceView {
  page: number | null
  section: string | null
  quote: string // verbatim evidence (PRD 14.2/23.2)
  passage: string // surrounding chunk content, for the highlighted View Source
}

export interface AnswerReviewItem {
  id: string
  type: QuestionType
  prompt: string
  options: string[] // same per-attempt display order as the review (PRD 24.1)
  userAnswer: string | null
  correctAnswer: string
  explanation: string
  isCorrect: boolean
  skipped: boolean
  source: SourceView
}

export interface AnswerReview {
  attemptId: string
  reviewerId: string
  reviewerName: string
  total: number
  correct: number
  percentage: number
  completedAt: string | null
  items: AnswerReviewItem[]
}

export interface AttemptHistoryEntry {
  attemptId: string
  number: number
  score: number
  total: number
  percentage: number
  completedAt: string | null
}

/** A completed attempt can be read; anything else is a navigation signal. */
export type AttemptAccess<T> =
  | { ok: true; value: T }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'in_progress'; attemptId: string }

function loadOwnedAttempt(attemptId: string): Promise<Attempt | null> {
  return createClient().then((supabase) =>
    supabase
      .from('attempts')
      .select('*')
      .eq('id', attemptId)
      .maybeSingle()
      .then(({ data }) => (data as Attempt | null) ?? null),
  )
}

/** Latest completed attempt id for a reviewer, or null (drives /results default). */
export async function getLatestCompletedAttemptId(reviewerId: string): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('attempts')
    .select('id')
    .eq('reviewer_id', reviewerId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}

/** Results page data for one completed attempt (PRD 22). */
export async function getResults(attemptId: string): Promise<AttemptAccess<AttemptSummary>> {
  const attempt = await loadOwnedAttempt(attemptId)
  if (!attempt) return { ok: false, reason: 'not_found' }
  if (attempt.status !== 'completed') return { ok: false, reason: 'in_progress', attemptId }

  const supabase = await createClient()
  const [{ data: reviewer }, { data: answerRows }] = await Promise.all([
    supabase.from('reviewers').select('id, name').eq('id', attempt.reviewer_id).maybeSingle(),
    supabase.from('attempt_answers').select('user_answer, is_correct').eq('attempt_id', attemptId),
  ])
  const total = attempt.total_questions
  const { correct, incorrect, skipped } = summarizeAnswers(answerRows ?? [], total)

  return {
    ok: true,
    value: {
      attemptId,
      reviewerId: attempt.reviewer_id,
      reviewerName: (reviewer?.name as string | undefined) ?? 'Reviewer',
      total,
      correct,
      incorrect,
      skipped,
      percentage: Number(attempt.percentage ?? 0),
      completedAt: attempt.completed_at,
    },
  }
}

/**
 * Full answer review for a completed attempt (PRD 23): your answer, the
 * correct answer, the explanation and the source evidence for every question,
 * in the same per-attempt order the user answered them in.
 */
export async function getAnswerReview(attemptId: string): Promise<AttemptAccess<AnswerReview>> {
  const attempt = await loadOwnedAttempt(attemptId)
  if (!attempt) return { ok: false, reason: 'not_found' }
  if (attempt.status !== 'completed') return { ok: false, reason: 'in_progress', attemptId }

  const supabase = await createClient()
  const [{ data: reviewer }, { data: questionRows }, { data: answerRows }] = await Promise.all([
    supabase.from('reviewers').select('id, name').eq('id', attempt.reviewer_id).maybeSingle(),
    supabase
      .from('questions')
      .select('*')
      .eq('reviewer_id', attempt.reviewer_id)
      .order('order_index', { ascending: true }),
    supabase.from('attempt_answers').select('*').eq('attempt_id', attemptId),
  ])

  const questions = (questionRows ?? []) as Question[]
  const answerByQuestion = new Map<string, AttemptAnswer>(
    ((answerRows ?? []) as AttemptAnswer[]).map((a) => [a.question_id, a]),
  )

  // Batch-load the evidence chunks so View Source can show the surrounding
  // passage with the quoted sentence highlighted (PRD 23.2).
  const chunkIds = [...new Set(questions.map((q) => q.source_chunk_id).filter(Boolean))]
  const chunkById = new Map<string, DocumentChunk>()
  if (chunkIds.length > 0) {
    const { data: chunks } = await supabase
      .from('document_chunks')
      .select('*')
      .in('id', chunkIds)
    for (const c of (chunks ?? []) as DocumentChunk[]) chunkById.set(c.id, c)
  }

  const ordered = seededShuffle(questions, attempt.shuffle_seed)
  const items: AnswerReviewItem[] = ordered.map((q) => {
    const ans = answerByQuestion.get(q.id)
    const skipped = !ans || ans.user_answer === null
    return {
      id: q.id,
      type: q.type,
      prompt: q.question,
      options:
        q.type === 'multiple_choice'
          ? seededShuffle(q.options, combineSeeds(attempt.shuffle_seed, hashStringToSeed(q.id)))
          : q.options,
      userAnswer: ans?.user_answer ?? null,
      correctAnswer: q.correct_answer,
      explanation: q.explanation,
      isCorrect: ans?.is_correct ?? false,
      skipped,
      source: {
        page: q.source_page,
        section: q.source_section,
        quote: q.source_text,
        passage: chunkById.get(q.source_chunk_id)?.content ?? q.source_text,
      },
    }
  })

  const correct = items.filter((i) => i.isCorrect).length
  return {
    ok: true,
    value: {
      attemptId,
      reviewerId: attempt.reviewer_id,
      reviewerName: (reviewer?.name as string | undefined) ?? 'Reviewer',
      total: attempt.total_questions,
      correct,
      percentage: Number(attempt.percentage ?? 0),
      completedAt: attempt.completed_at,
      items,
    },
  }
}

/** All completed attempts for a reviewer, oldest first, numbered (PRD 24.2). */
export async function listAttemptHistory(reviewerId: string): Promise<AttemptHistoryEntry[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('attempts')
    .select('id, score, total_questions, percentage, completed_at')
    .eq('reviewer_id', reviewerId)
    .eq('status', 'completed')
    .order('started_at', { ascending: true })
  return (data ?? []).map((a, i) => ({
    attemptId: a.id as string,
    number: i + 1,
    score: (a.score as number | null) ?? 0,
    total: a.total_questions as number,
    percentage: Number(a.percentage ?? 0),
    completedAt: a.completed_at as string | null,
  }))
}

export type ReportResult = { ok: true } | { ok: false; error: string }

/**
 * Store a question report (PRD 23.4). RLS guarantees the question belongs to a
 * reviewer this user owns and that user_id is the caller; we validate the
 * reason against the fixed selector and cap the free-text note.
 */
export async function reportQuestion(
  questionId: string,
  reason: string,
  note: string,
): Promise<ReportResult> {
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
    return { ok: false, error: 'Choose a report reason.' }
  }
  const cleanNote = note.trim().slice(0, 1000)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'You need to be signed in.' }

  // The question must exist and belong to this user's reviewer (RLS-scoped).
  const { data: question } = await supabase
    .from('questions')
    .select('id')
    .eq('id', questionId)
    .maybeSingle()
  if (!question) return { ok: false, error: 'Question not found.' }

  const { error } = await supabase.from('question_reports').insert({
    question_id: questionId,
    user_id: user.id,
    reason,
    note: cleanNote || null,
  })
  if (error) return { ok: false, error: 'Could not submit your report. Please try again.' }
  return { ok: true }
}
