import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOCUMENTS_BUCKET, type ReviewerMode, type ReviewerStatus } from '@/lib/constants'
import type { ReviewerCard, Reviewer, Document } from '@/lib/types'
import { listAttemptHistory, type AttemptHistoryEntry } from './results'

/**
 * Server-side data access (PRD 28.2 layering: UI -> application logic ->
 * API/server actions -> database). No business logic in components.
 */

/** Dashboard list (PRD 9): reviewer + source file + attempt summary. */
export async function getReviewerCards(userId: string): Promise<ReviewerCard[]> {
  const supabase = await createClient()

  const { data: reviewers, error } = await supabase
    .from('reviewers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`Failed to load reviewers: ${error.message}`)

  const ids = (reviewers ?? []).map((r) => r.id)
  if (ids.length === 0) return []

  const [documents, attempts, deckRows] = await Promise.all([
    supabase
      .from('documents')
      .select('reviewer_id, file_name')
      .in('reviewer_id', ids)
      .order('created_at', { ascending: true }),
    supabase
      .from('attempts')
      .select('reviewer_id, user_id, status, score, total_questions, completed_at')
      .in('reviewer_id', ids),
    // Stored deck sizes: the deliverable count for 'flashcards_only' rows.
    // Bounded by the reviewer quota x FLASHCARDS.MAX_TOTAL, so one cheap read.
    supabase.from('flashcards').select('reviewer_id').in('reviewer_id', ids),
  ])

  const docByReviewer = new Map(
    (documents.data ?? []).map((d) => [d.reviewer_id, d.file_name]),
  )
  const allAttempts = attempts.data ?? []
  const deckCounts = new Map<string, number>()
  for (const row of deckRows.data ?? []) {
    deckCounts.set(row.reviewer_id, (deckCounts.get(row.reviewer_id) ?? 0) + 1)
  }

  return (reviewers as Reviewer[]).map((reviewer) => {
    const reviewerAttempts = allAttempts.filter(
      (a) => a.reviewer_id === reviewer.id && a.status === 'completed' && a.completed_at,
    )
    const latest = reviewerAttempts.sort(
      (a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime(),
    )[0]
    return {
      reviewer,
      sourceFileName: docByReviewer.get(reviewer.id) ?? null,
      lastAttemptedAt: latest?.completed_at ?? null,
      latestScore:
        latest && latest.score != null
          ? { score: latest.score, total: latest.total_questions }
          : null,
      hasInProgressAttempt: allAttempts.some(
        (a) => a.reviewer_id === reviewer.id && a.user_id === userId && a.status === 'in_progress',
      ),
      flashcardCount: deckCounts.get(reviewer.id) ?? 0,
    }
  })
}

/**
 * Hard delete with full cleanup (PRD 26.3/27.4, decision: no undo window).
 * DB cascade removes documents, chunks, jobs, questions, reports,
 * rejected_questions, attempts, answers. Storage files must be removed
 * explicitly - verified here so no private file survives deletion.
 */
export async function deleteReviewer(reviewerId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  // Ownership enforced by RLS on select + delete; this also blocks self-review
  // races (deleting another user's id returns nothing).
  const { data: reviewer } = await supabase
    .from('reviewers')
    .select('id')
    .eq('id', reviewerId)
    .single()
  if (!reviewer) return { ok: false, error: 'Reviewer not found.' }

  const { data: docs } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('reviewer_id', reviewerId)

  const { error: deleteError } = await supabase
    .from('reviewers')
    .delete()
    .eq('id', reviewerId)
  if (deleteError) return { ok: false, error: 'Could not delete reviewer. Please try again.' }

  // Remove the original files from private storage (service role - storage
  // policies are per-user, and cleanup must succeed even in edge cases).
  const paths = (docs ?? []).map((d) => d.storage_path)
  if (paths.length > 0) {
    const admin = createAdminClient()
    const { error: storageError } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .remove(paths)
    if (storageError) {
      // Row is gone; log for a reconciliation sweep rather than blocking the user.
      console.error(`Storage cleanup failed for reviewer ${reviewerId}:`, storageError)
    }
  }

  return { ok: true }
}

/** Full reviewer row for the detail page. RLS-scoped: another user's id -> null. */
export async function getReviewer(reviewerId: string): Promise<Reviewer | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reviewers')
    .select('*')
    .eq('id', reviewerId)
    .maybeSingle()
  return (data as Reviewer | null) ?? null
}

export interface ReviewerStatusView {
  status: ReviewerStatus
  stage: string | null
  errorCode: string | null
  errorMessage: string | null
  /** When the active job really started (null while queued). Powers the
   * processing screen's honest elapsed clock (PRD 13.3). */
  startedAt: string | null
  requestedQuestionCount: number
  /** Deck-mode reviewers get deck-worded stages (PRD 13.3 honesty). */
  mode: ReviewerMode
}

/**
 * Lightweight snapshot for the processing screen's polling (PRD 29.3). Reads
 * the reviewer lifecycle status plus the active job's real stage - never a
 * fabricated percentage. Ownership is enforced by RLS on both reads.
 */
export async function getReviewerStatus(reviewerId: string): Promise<ReviewerStatusView | null> {
  const supabase = await createClient()
  const { data: reviewer } = await supabase
    .from('reviewers')
    .select('status, requested_question_count, mode')
    .eq('id', reviewerId)
    .maybeSingle()
  if (!reviewer) return null
  const mode = (reviewer.mode ?? 'questions') as ReviewerMode

  // Prefer the in-flight job's stage; fall back to the most recent terminal one.
  const { data: active } = await supabase
    .from('generation_jobs')
    .select('stage, error_code, error_message, started_at')
    .eq('reviewer_id', reviewerId)
    .in('status', ['queued', 'running'])
    .order('started_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (active) {
    return {
      status: reviewer.status as ReviewerStatus,
      stage: active.stage,
      errorCode: active.error_code,
      errorMessage: active.error_message,
      startedAt: active.started_at,
      requestedQuestionCount: reviewer.requested_question_count as number,
      mode,
    }
  }

  const { data: last } = await supabase
    .from('generation_jobs')
    .select('stage, error_code, error_message, started_at')
    .eq('reviewer_id', reviewerId)
    .eq('status', 'failed')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    status: reviewer.status as ReviewerStatus,
    stage: last?.stage ?? null,
    errorCode: last?.error_code ?? null,
    errorMessage: last?.error_message ?? null,
    startedAt: last?.started_at ?? null,
    requestedQuestionCount: reviewer.requested_question_count as number,
    mode,
  }
}

export interface VerifyData {
  reviewer: Reviewer
  document: Pick<Document, 'file_name' | 'page_count' | 'text_quality_score'> | null
  chunkCount: number
  topics: { title: string; count: number }[]
}

/**
 * Verify Material screen data (PRD 12): what we detected in the document so
 * the user can confirm the source is right before any AI generation. Sections/
 * topics are the distinct chunk section titles; the quality signal is the
 * stored text_quality_score + page count.
 */
export async function getVerifyData(reviewerId: string): Promise<VerifyData | null> {
  const supabase = await createClient()

  const reviewer = await getReviewer(reviewerId)
  if (!reviewer) return null

  const { data: doc } = await supabase
    .from('documents')
    .select('id, file_name, page_count, text_quality_score')
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  // Aggregate chunk section titles for the detected-topics list.
  let topics: { title: string; count: number }[] = []
  let chunkCount = 0
  if (doc) {
    const { data: rows } = await supabase
      .from('document_chunks')
      .select('section_title')
      .eq('document_id', doc.id)
    chunkCount = rows?.length ?? 0
    const tally = new Map<string, number>()
    for (const c of rows ?? []) {
      const t = (c.section_title ?? '').trim()
      if (!t) continue
      tally.set(t, (tally.get(t) ?? 0) + 1)
    }
    topics = [...tally.entries()]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }

  return {
    reviewer,
    document: doc
      ? {
          file_name: doc.file_name,
          page_count: doc.page_count,
          text_quality_score: doc.text_quality_score,
        }
      : null,
    chunkCount,
    topics,
  }
}

export interface ReadyData {
  reviewer: Reviewer
  questionCount: number
  requested: number
  byType: { multiple_choice: number; true_false: number; identification: number }
  byDifficulty: { easy: number; medium: number; hard: number }
  topics: { title: string; count: number }[]
  /** Completed attempts, oldest first, for the retake/history list (PRD 24.2). */
  attempts: AttemptHistoryEntry[]
}

/**
 * Ready screen data (PRD 25/16.2). Shows the REAL number of stored questions
 * (which may be below the request - we never fabricate), plus the coverage
 * and type/difficulty mix so the user can see questions are spread across
 * their material. All reads are RLS-scoped.
 */
export async function getReadyData(reviewerId: string): Promise<ReadyData | null> {
  const supabase = await createClient()
  const reviewer = await getReviewer(reviewerId)
  if (!reviewer) return null

  const { data: rows } = await supabase
    .from('questions')
    .select('type, difficulty, topic')
    .eq('reviewer_id', reviewerId)
  const questions = rows ?? []
  const attempts = await listAttemptHistory(reviewerId)

  const byType = { multiple_choice: 0, true_false: 0, identification: 0 }
  const byDifficulty = { easy: 0, medium: 0, hard: 0 }
  const tally = new Map<string, number>()
  for (const q of questions) {
    if (q.type in byType) byType[q.type as keyof typeof byType]++
    if (q.difficulty === 'mixed') continue
    if (q.difficulty in byDifficulty) byDifficulty[q.difficulty as keyof typeof byDifficulty]++
    const t = (q.topic ?? '').trim()
    if (t) tally.set(t, (tally.get(t) ?? 0) + 1)
  }

  return {
    reviewer,
    questionCount: questions.length,
    requested: reviewer.requested_question_count,
    byType,
    byDifficulty,
    topics: [...tally.entries()]
      .map(([title, count]) => ({ title, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12),
    attempts,
  }
}
