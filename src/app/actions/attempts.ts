'use server'

import {
  startOrResumeReview,
  saveAnswer,
  finishAttempt,
  type SessionResult,
  type AnswerResult,
  type FinishResult,
} from '@/lib/data/attempts'
import { reportQuestion, type ReportResult } from '@/lib/data/results'

/**
 * Thin 'use server' wrappers over the Phase 4 review flow in
 * src/lib/data/attempts.ts. Ownership (RLS), in-progress checks, answer
 * validation and all scoring live in the data layer, never in the UI.
 * saveAnswer/finishAttempt deliberately do NOT return correctness info
 * (PRD 21.2: nothing is revealed until the attempt is finished).
 */

export async function startOrResumeReviewAction(reviewerId: string): Promise<SessionResult> {
  return startOrResumeReview(reviewerId)
}

export async function saveAnswerAction(
  attemptId: string,
  questionId: string,
  userAnswer: string,
): Promise<AnswerResult> {
  return saveAnswer(attemptId, questionId, userAnswer)
}

export async function finishAttemptAction(attemptId: string): Promise<FinishResult> {
  return finishAttempt(attemptId)
}

/**
 * Report a question from the answer-review screen (PRD 23.4). Ownership and
 * the fixed reason set are validated in the data layer, never trusted here.
 */
export async function reportQuestionAction(
  questionId: string,
  reason: string,
  note: string,
): Promise<ReportResult> {
  return reportQuestion(questionId, reason, note)
}
