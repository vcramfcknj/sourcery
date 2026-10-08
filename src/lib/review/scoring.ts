/**
 * Pure attempt-scoring helpers (PRD 22/26.3). Kept free of any server-only or
 * database imports so they can be unit-tested directly; the results data layer
 * composes them with server-read rows. Correctness itself is always decided
 * upstream on the server - this only tallies already-scored answers.
 */

export interface AnswerLike {
  user_answer: string | null
  is_correct: boolean
}

export interface AttemptBreakdown {
  correct: number
  incorrect: number // includes skipped (PRD 22)
  skipped: number
}

/**
 * Tally an attempt's already-scored answers against the question total.
 * `answers` are the attempt's rows (finishAttempt backfills skipped ones as
 * user_answer null / is_correct false), `total` is the question count.
 */
export function summarizeAnswers(answers: AnswerLike[], total: number): AttemptBreakdown {
  const correct = answers.filter((a) => a.is_correct).length
  const skipped = answers.filter((a) => a.user_answer === null).length
  return { correct, incorrect: total - correct, skipped }
}

/**
 * Canonical form for grading a typed (identification) answer: lower-case, drop
 * punctuation, ignore leading articles and collapse whitespace. This is the
 * ONLY place the fuzzy match lives so the server grader and any tests agree.
 */
export function normalizeAnswer(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\b(a|an|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Grade a free-text identification answer on the server. The stored
 * correct_answer may list a few accepted forms slash-separated (per the
 * generation prompt); the answer is correct when its normalized form matches
 * any normalized accepted form exactly.
 */
export function isIdentificationCorrect(
  userAnswer: string | null,
  correctAnswer: string,
): boolean {
  if (userAnswer == null) return false
  const given = normalizeAnswer(userAnswer)
  if (!given) return false
  return correctAnswer
    .split('/')
    .map((alt) => normalizeAnswer(alt))
    .filter(Boolean)
    .some((alt) => alt === given)
}
