import { generateObject } from 'ai'
import { generationModel } from '../ai/provider'
import { generationOutputSchema, type Candidate } from '../ai/schemas'
import { buildGenerationPrompt } from '../ai/prompts'
import { PIPELINE } from '../constants'
import type { GenerationTask } from './coverage'

/**
 * Candidate generation (PRD 13.1 "GENERATE CANDIDATE QUESTIONS"). One
 * structured-output call per coverage task. A call that fails to parse is
 * DISCARDED, not retried forever (PRD 27.3), and never blocks the rest of
 * the run. Explanation ships in the same call as the question (PRD 23.3
 * pipeline-order decision).
 */

export interface CandidateWithContext {
  candidate: Candidate
  chunkId: string
  chunkContent: string
  sectionTitle: string | null
  page: number | null
}

export interface GenerationUsage {
  calls: number
  promptTokens: number
  completionTokens: number
}

export async function generateCandidates(
  tasks: GenerationTask[],
  onCall?: (done: number, total: number) => Promise<void> | void,
): Promise<{ candidates: CandidateWithContext[]; usage: GenerationUsage }> {
  const usage: GenerationUsage = { calls: 0, promptTokens: 0, completionTokens: 0 }
  // Positional slots keep candidates in coverage-plan order regardless of
  // which call finishes first, so downstream selection stays deterministic.
  const slots: CandidateWithContext[][] = new Array(tasks.length).fill(null).map(() => [])
  let done = 0
  let cursor = 0

  // Bounded worker pool: one pull-loop per concurrent slot. JS is
  // single-threaded, so `cursor++` and the usage counters need no lock.
  const worker = async () => {
    while (cursor < tasks.length) {
      const i = cursor++
      const task = tasks[i]
      try {
        const result = await generateObject({
          model: generationModel(),
          schema: generationOutputSchema,
          maxRetries: 3, // ride out transient free-tier 429s before discarding
          prompt: buildGenerationPrompt({
            chunkContent: task.chunk.content,
            sectionTitle: task.chunk.section_title,
            types: task.types,
            difficulty: task.difficulty,
            count: task.count,
          }),
        })
        usage.calls += 1
        usage.promptTokens += result.usage?.inputTokens ?? 0
        usage.completionTokens += result.usage?.outputTokens ?? 0
        slots[i] = result.object.candidates.map((candidate) => ({
          candidate,
          chunkId: task.chunk.id,
          chunkContent: task.chunk.content,
          sectionTitle: task.chunk.section_title,
          page: task.chunk.page_number,
        }))
      } catch (err) {
        // Malformed/unparseable output is discarded (PRD 27.3); a rate-limit
        // or outage on one chunk must not sink the whole job.
        console.error(
          `[generate] call ${i + 1}/${tasks.length} for chunk ${task.chunk.id} discarded:`,
          err instanceof Error ? err.message : err,
        )
      }
      done += 1
      await onCall?.(done, tasks.length)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PIPELINE.GENERATION_CONCURRENCY, tasks.length) }, worker),
  )
  const out = slots.flat()

  // Cost visibility (PRD 30): one log line per generation run.
  console.log(
    `[generate] usage: calls=${usage.calls} prompt_tokens=${usage.promptTokens} completion_tokens=${usage.completionTokens} candidates=${out.length}`,
  )
  return { candidates: out, usage }
}
