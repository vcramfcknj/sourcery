import { PIPELINE, type Difficulty, type QuestionType } from '../constants'
import type { CandidateWithContext } from './generate'

/**
 * Deduplication + selection (PRD 16.2-16.4, 19.1). After L1-L3 trim the
 * over-generated candidates, we choose the final set so it (a) stays spread
 * across sections rather than clustered, (b) honors the requested type and
 * difficulty mix as far as the material supports, and (c) keeps True/False
 * answers balanced between 40% and 60% (PRD 16.3).
 *
 * The system never fabricates to hit a count: we return AT MOST `requested`,
 * and the caller shows the honest real number when it falls short (PRD 25).
 */

export interface SelectionResult {
  selected: CandidateWithContext[]
  /** True if valid questions came in below the minimum viable count. */
  belowMinimum: boolean
}

function sectionOf(c: CandidateWithContext): string {
  return (c.sectionTitle ?? c.chunkId).toLowerCase()
}

/** Deterministic-but-varied option shuffle so the answer isn't biased to a slot. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Randomize each multiple-choice question's option order server-side and keep
 * correctAnswer pointing at the same option text (position changes, value
 * does not). True/False options stay in canonical [True, False] order.
 */
export function randomizeOptionOrder(items: CandidateWithContext[]): CandidateWithContext[] {
  return items.map((item) => {
    if (item.candidate.type !== 'multiple_choice') return item
    const options = shuffle(item.candidate.options)
    return { ...item, candidate: { ...item.candidate, options } }
  })
}

/** Next candidate from the section we have drawn from least (coverage-first). */
function pickSpreading(pool: CandidateWithContext[], takenSections: Map<string, number>): CandidateWithContext {
  let best = pool[0]
  let bestCount = Infinity
  for (const c of pool) {
    const n = takenSections.get(sectionOf(c)) ?? 0
    if (n < bestCount) {
      bestCount = n
      best = c
    }
  }
  return best
}

export function selectFinal(
  candidates: CandidateWithContext[],
  requested: number,
  types: QuestionType[],
  difficulty: Difficulty,
): SelectionResult {
  void difficulty // honored by the generator's per-task difficulty; selection balances types/coverage

  // Partition by type. T/F is split by answer so we can keep it ~50/50 (PRD 16.3).
  const mc = candidates.filter((c) => c.candidate.type === 'multiple_choice')
  const id = candidates.filter((c) => c.candidate.type === 'identification')
  const tfAll = candidates.filter((c) => c.candidate.type === 'true_false')
  const tfTrue = tfAll.filter((c) => c.candidate.correctAnswer === 'True')
  const tfFalse = tfAll.filter((c) => c.candidate.correctAnswer === 'False')

  const selected: CandidateWithContext[] = []
  const takenSections = new Map<string, number>()

  const take = (pool: CandidateWithContext[]) => {
    if (pool.length === 0) return false
    const chosen = pickSpreading(pool, takenSections)
    selected.push(chosen)
    pool.splice(pool.indexOf(chosen), 1)
    const key = sectionOf(chosen)
    takenSections.set(key, (takenSections.get(key) ?? 0) + 1)
    return true
  }

  // Draw one T/F candidate, always from the under-represented answer side.
  let tfTakenTrue = 0
  let tfTakenFalse = 0
  const takeTF = () => {
    const canTrue = tfTrue.length > 0
    const canFalse = tfFalse.length > 0
    if (!canTrue && !canFalse) return false
    const fromTrue =
      canTrue && canFalse ? tfTakenTrue <= tfTakenFalse : canTrue
    const pool = fromTrue ? tfTrue : tfFalse
    if (!take(pool)) return false
    if (fromTrue) tfTakenTrue++
    else tfTakenFalse++
    return true
  }

  // One drawer per requested type, then round-robin them so the mix stays even
  // and, when one type runs dry, the others keep filling toward `requested`.
  const drawers: (() => boolean)[] = []
  if (types.includes('multiple_choice')) drawers.push(() => take(mc))
  if (types.includes('identification')) drawers.push(() => take(id))
  if (types.includes('true_false')) drawers.push(takeTF)

  let progressed = true
  while (selected.length < requested && progressed) {
    progressed = false
    for (const draw of drawers) {
      if (selected.length >= requested) break
      if (draw()) progressed = true
    }
  }

  return {
    selected: randomizeOptionOrder(selected),
    belowMinimum: selected.length < PIPELINE.MIN_VIABLE_QUESTIONS,
  }
}
