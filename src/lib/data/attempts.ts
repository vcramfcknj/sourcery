import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Attempt, AttemptAnswer, Question, Reviewer } from '@/lib/types'
import type { QuestionType } from '@/lib/constants'
import { seededShuffle, hashStringToSeed, combineSeeds } from '@/lib/review/shuffle'
import { isIdentificationCorrect } from '@/lib/review/scoring'

/**
 * Review session data layer (PRD 21/24). Everything that decides correctness
 * stays on the server: the review UI only ever receives question text and
 * display-shuffled options - never correct_answer, explanation, or evidence
 * (PRD 21.2 "do not reveal answers during review"), and is_correct/score/
 * percentage are computed server-side only (PRD 26.3).
 */

export interface ReviewQuestionView {
  id: string
  type: QuestionType
  prompt: string
  /** Already in this attempt's display order (MC shuffled per seed, PRD 24.1). */
  options: string[]
  /** Section heading shown above the question (PRD 21.1); falls back to the reviewer name. */
  heading: string
  /** The user's saved choice for this attempt, or null (resume, PRD 21.5). */
  savedAnswer: string | null
}

export interface ReviewSession {
  attemptId: string
  reviewerId: string
  reviewerName: string
  totalQuestions: number
  questions: ReviewQuestionView[]
  /** Resume opens at the first unanswered question (PRD 21.5). */
  firstUnansweredIndex: number
}

export type SessionResult = { ok: true; session: ReviewSession } | { ok: false; error: string }

/** Positive int seed for attempts (fits Postgres `int`). */
function randomSeed(): number {
  return (crypto.getRandomValues(new Uint32Array(1))[0] % 2_147_483_646) + 1
}

/**
 * Start or resume the review for a ready reviewer (PRD 9.1/21.5).
 * Reuses the single in-progress attempt if one exists; otherwise creates a
 * new one (a retake after completion lands here too). The partial unique
 * index attempts_one_in_progress makes "one in-progress per user+reviewer"
 * a database guarantee; on a race we simply re-read the winner.
 */
export async function startOrResumeReview(reviewerId: string): Promise<SessionResult> {
  const supabase = await createClient()

  const { data: reviewer } = await supabase
    .from('reviewers')
    .select('*')
    .eq('id', reviewerId)
    .maybeSingle()
  if (!reviewer) return { ok: false, error: 'Reviewer not found.' }
  if (reviewer.status !== 'ready') return { ok: false, error: 'This reviewer is not ready yet.' }

  const { data: questionRows } = await supabase
    .from('questions')
    .select('*')
    .eq('reviewer_id', reviewerId)
    .order('order_index', { ascending: true })
  const questions = (questionRows ?? []) as Question[]
  if (questions.length === 0) return { ok: false, error: 'This reviewer has no questions yet.' }

  const findInProgress = async () =>
    (
      await supabase
        .from('attempts')
        .select('*')
        .eq('reviewer_id', reviewerId)
        .eq('status', 'in_progress')
        .order('started_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    ).data as Attempt | null

  let attempt = await findInProgress()
  if (!attempt) {
    const { data: created, error } = await supabase
      .from('attempts')
      .insert({
        reviewer_id: reviewerId,
        user_id: (reviewer as Reviewer).user_id,
        status: 'in_progress',
        shuffle_seed: randomSeed(),
        total_questions: questions.length,
      })
      .select('*')
      .maybeSingle()
    if (error && error.code !== '23505') {
      return { ok: false, error: 'Could not start the review. Please try again.' }
    }
    // 23505 = another tab raced us to the unique in-progress index; adopt it.
    attempt = created as Attempt | null ?? (await findInProgress())
  }
  if (!attempt) return { ok: false, error: 'Could not start the review. Please try again.' }

  const { data: answerRows } = await supabase
    .from('attempt_answers')
    .select('*')
    .eq('attempt_id', attempt.id)
  const answerByQuestion = new Map<string, AttemptAnswer>(
    ((answerRows ?? []) as AttemptAnswer[]).map((a) => [a.question_id, a]),
  )

  // Deterministic per-attempt ordering from the stored seed (PRD 24.1).
  const ordered = seededShuffle(questions, attempt.shuffle_seed)
  const views: ReviewQuestionView[] = ordered.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.question,
    // MC option order is shuffled per attempt; True/False keeps its canonical
    // ["True", "False"] order (PRD 19.2 reading convention).
    options:
      q.type === 'multiple_choice'
        ? seededShuffle(q.options, combineSeeds(attempt.shuffle_seed, hashStringToSeed(q.id)))
        : q.options,
    heading: (q.source_section ?? '').trim() || reviewer.name,
    savedAnswer: answerByQuestion.get(q.id)?.user_answer ?? null,
  }))

  const firstOpen = views.findIndex((v) => v.savedAnswer === null)
  return {
    ok: true,
    session: {
      attemptId: attempt.id,
      reviewerId: reviewerId,
      reviewerName: reviewer.name,
      totalQuestions: views.length,
      questions: views,
      firstUnansweredIndex: firstOpen === -1 ? 0 : firstOpen,
    },
  }
}

export type AnswerResult = { ok: true } | { ok: false; error: string }

/**
 * Persist one answer immediately (PRD 21.4). Correctness is computed here,
 * on the server, and never returned to the client - the review must not
 * reveal it (PRD 21.2). Re-answering upserts the same row (PRD 21.3 allows
 * changing until the attempt is finished).
 */
export async function saveAnswer(
  attemptId: string,
  questionId: string,
  userAnswer: string,
): Promise<AnswerResult> {
  const supabase = await createClient()

  const { data: attempt } = await supabase
    .from('attempts')
    .select('id, status, reviewer_id')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt) return { ok: false, error: 'Attempt not found.' }
  if (attempt.status !== 'in_progress') return { ok: false, error: 'This attempt is already finished.' }

  // The question must belong to this attempt's reviewer (no cross-reviewer writes).
  const { data: question } = await supabase
    .from('questions')
    .select('id, type, options, correct_answer, version')
    .eq('id', questionId)
    .eq('reviewer_id', attempt.reviewer_id)
    .maybeSingle()
  if (!question) return { ok: false, error: 'Question not found.' }

  // Correctness is decided HERE on the server and never returned (PRD 21.2/26.3).
  // Selection types must send one of their options; identification is free text
  // graded by a normalized match against the accepted term(s).
  let isCorrect: boolean
  if (question.type === 'identification') {
    if (!userAnswer.trim()) return { ok: false, error: 'Type an answer first.' }
    isCorrect = isIdentificationCorrect(userAnswer, question.correct_answer)
  } else {
    const options = question.options as string[]
    if (!options.includes(userAnswer)) return { ok: false, error: 'That answer is not one of the options.' }
    isCorrect = userAnswer === question.correct_answer
  }
  const { error } = await supabase
    .from('attempt_answers')
    .upsert(
      {
        attempt_id: attemptId,
        question_id: questionId,
        question_version: question.version,
        user_answer: userAnswer,
        is_correct: isCorrect,
        answered_at: new Date().toISOString(),
      },
      { onConflict: 'attempt_id,question_id' },
    )
  if (error) return { ok: false, error: 'Could not save your answer. Please try again.' }
  return { ok: true }
}

export type FinishResult =
  | { ok: true; score: number; total: number; percentage: number }
  | { ok: false; error: string }

/**
 * Finish the attempt (PRD 21.6/22): unanswered questions are recorded as
 * skipped (null answer, incorrect) and included in the total; the score and
 * percentage are computed here, server-side only (PRD 26.3). Idempotent:
 * finishing an already-completed attempt returns its stored result.
 */
export async function finishAttempt(attemptId: string): Promise<FinishResult> {
  const supabase = await createClient()

  const { data: attempt } = await supabase
    .from('attempts')
    .select('id, status, reviewer_id, score, total_questions, percentage')
    .eq('id', attemptId)
    .maybeSingle()
  if (!attempt) return { ok: false, error: 'Attempt not found.' }
  if (attempt.status === 'completed') {
    return {
      ok: true,
      score: attempt.score ?? 0,
      total: attempt.total_questions,
      percentage: Number(attempt.percentage ?? 0),
    }
  }

  const { data: questionRows } = await supabase
    .from('questions')
    .select('id, version')
    .eq('reviewer_id', attempt.reviewer_id)
  const questions = questionRows ?? []
  if (questions.length === 0) return { ok: false, error: 'This reviewer has no questions.' }

  const { data: answerRows, error: answerReadError } = await supabase
    .from('attempt_answers')
    .select('question_id, is_correct')
    .eq('attempt_id', attemptId)
  if (answerReadError) return { ok: false, error: 'Could not finish the review. Please try again.' }
  const answers = answerRows ?? []

  // Record skipped questions as incorrect (PRD 21.6 decision).
  const answered = new Set(answers.map((a) => a.question_id))
  const skipped = questions.filter((q) => !answered.has(q.id)).map((q) => ({
    attempt_id: attemptId,
    question_id: q.id,
    question_version: q.version,
    user_answer: null,
    is_correct: false,
  }))
  if (skipped.length > 0) {
    const { error: insertError } = await supabase.from('attempt_answers').insert(skipped)
    if (insertError) return { ok: false, error: 'Could not finish the review. Please try again.' }
  }

  const total = questions.length
  const score = answers.filter((a) => a.is_correct).length
  const percentage = Math.round((score / total) * 10000) / 100

  const { error: updateError } = await supabase
    .from('attempts')
    .update({
      status: 'completed',
      score,
      total_questions: total,
      percentage,
      completed_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
  if (updateError) return { ok: false, error: 'Could not finish the review. Please try again.' }

  return { ok: true, score, total, percentage }
}
