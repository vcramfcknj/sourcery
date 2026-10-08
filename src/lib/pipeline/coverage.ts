import { PIPELINE, type Difficulty, type QuestionType } from '../constants'
import type { DocumentChunk } from '../types'

/**
 * Coverage planning (PRD 16.2). Questions must be spread across the
 * document, not clustered in the first pages: group chunks by section,
 * allocate the over-generated candidate budget proportionally to section
 * size, and hand each chunk a small generation task.
 */

export interface GenerationTask {
  chunk: DocumentChunk
  /** Candidates to ask the model for from this chunk (<= CANDIDATES_PER_CALL). */
  count: number
  types: QuestionType[]
  difficulty: Exclude<Difficulty, 'mixed'>
}

const MIXED_DIFFICULTY_CYCLE: Exclude<Difficulty, 'mixed'>[] = [
  'easy', // ~40%
  'medium', // ~40%
  'easy',
  'medium',
  'hard', // ~20%
]

function sectionKey(chunk: DocumentChunk): string {
  return (chunk.section_title ?? '').trim().toLowerCase() || '__untitled__'
}

/**
 * Build the task list for one generation run.
 * `requested` is the user's question count; candidates are over-generated
 * at ~1.5x (PRD 16.2) so L1-L4 can trim without falling short.
 */
export function planCoverage(
  chunks: DocumentChunk[],
  requested: number,
  types: QuestionType[],
  difficulty: Difficulty,
): GenerationTask[] {
  if (chunks.length === 0) return []

  const candidateBudget = Math.min(
    PIPELINE.MAX_CANDIDATES_TOTAL,
    Math.max(requested, Math.ceil(requested * PIPELINE.OVER_GENERATION_FACTOR)),
  )

  // Group chunks by their nearest heading (PRD 16.2), preserving document order.
  const sections = new Map<string, DocumentChunk[]>()
  for (const c of chunks) {
    const key = sectionKey(c)
    const list = sections.get(key)
    if (list) list.push(c)
    else sections.set(key, [c])
  }

  // Allocate candidates per section proportional to its text size, with
  // low-value (tiny) sections allowed a zero allocation.
  const totalChars = chunks.reduce((sum, c) => sum + c.content.length, 0)
  const entries = [...sections.entries()].map(([key, list]) => ({
    key,
    list,
    share: list.reduce((sum, c) => sum + c.content.length, 0) / Math.max(1, totalChars),
  }))

  const allocations = entries.map((e) => ({
    ...e,
    quota: Math.floor(candidateBudget * e.share),
  }))
  // Distribute rounding slack to the largest sections first.
  let slack = candidateBudget - allocations.reduce((s, a) => s + a.quota, 0)
  const bySize = [...allocations].sort((a, b) => b.share - a.share)
  for (const a of bySize) {
    if (slack <= 0) break
    a.quota += 1
    slack -= 1
  }

  // Round-robin within each section so spread is even, and round-robin the
  // difficulty slots so "mixed" lands near 40/40/20 across the reviewer.
  const tasks: GenerationTask[] = []
  let difficultyCursor = 0
  const queues = allocations.map((a) => ({ remaining: [...a.list], quota: a.quota }))

  let progressed = true
  while (progressed) {
    progressed = false
    for (const q of queues) {
      if (q.quota <= 0) continue
      const chunk = q.remaining.shift()
      if (!chunk) continue
      // Ask this chunk for up to CANDIDATES_PER_CALL of its section's share,
      // so documents with few chunks still reach the over-generation budget.
      const count = Math.min(PIPELINE.CANDIDATES_PER_CALL, q.quota)
      q.quota -= count
      const diff: Exclude<Difficulty, 'mixed'> =
        difficulty === 'mixed'
          ? MIXED_DIFFICULTY_CYCLE[difficultyCursor++ % MIXED_DIFFICULTY_CYCLE.length]
          : difficulty
      tasks.push({ chunk, count, types, difficulty: diff })
      progressed = true
    }
  }

  return tasks.sort((a, b) => a.chunk.chunk_index - b.chunk.chunk_index)
}
