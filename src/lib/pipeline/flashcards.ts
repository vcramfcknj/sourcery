import { generateObject } from 'ai'
import { generationModel } from '../ai/provider'
import { flashcardsOutputSchema } from '../ai/schemas'
import { buildFlashcardsPrompt } from '../ai/prompts'
import { FLASHCARDS, PIPELINE } from '../constants'

/**
 * Printable flashcards generation (TRIAL module). A deliberately small
 * sibling of the question pipeline: it reuses the chunks that already exist
 * (no new upload path, no worker job), spreads its calls evenly across the
 * document so a long PDF still gets coverage, and caps total cost via
 * FLASHCARDS.MAX_CHUNKS / MAX_TOTAL. Unparseable calls are discarded, never
 * retried forever (PRD 27.3 applies here too).
 */

export interface FlashcardChunk {
  id: string
  content: string
  section_title: string | null
  page_number: number | null
}

export interface GeneratedFlashcard {
  front: string
  back: string
  sourcePage: number | null
  sourceSection: string | null
}

export interface FlashcardUsage {
  calls: number
  promptTokens: number
  completionTokens: number
}

/**
 * Pick up to `max` chunks spread evenly over the document (first, last and
 * evenly spaced in between) so the deck covers the whole material instead of
 * the opening pages. Pure and deterministic - smoke-testable.
 */
export function pickSpreadChunks<T>(chunks: T[], max = FLASHCARDS.MAX_CHUNKS): T[] {
  if (chunks.length <= max) return [...chunks]
  const step = (chunks.length - 1) / (max - 1)
  const picked: T[] = []
  for (let i = 0; i < max; i++) picked.push(chunks[Math.round(i * step)])
  return picked
}

/** Drop cards whose front repeats an earlier card's front (case/punct-insensitive). */
export function dedupeCards(cards: GeneratedFlashcard[]): GeneratedFlashcard[] {
  const seen = new Set<string>()
  return cards.filter((card) => {
    const key = card.front
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function generateFlashcards(
  chunks: FlashcardChunk[],
  onCall?: (done: number, total: number) => Promise<void> | void,
): Promise<{ cards: GeneratedFlashcard[]; usage: FlashcardUsage }> {
  const picked = pickSpreadChunks(chunks)
  const usage: FlashcardUsage = { calls: 0, promptTokens: 0, completionTokens: 0 }
  // Positional slots keep chunk order deterministic despite parallelism.
  const slots: GeneratedFlashcard[][] = new Array(picked.length).fill(null).map(() => [])
  let done = 0
  let cursor = 0

  const worker = async () => {
    while (cursor < picked.length) {
      const i = cursor++
      const chunk = picked[i]
      try {
        const result = await generateObject({
          model: generationModel(),
          schema: flashcardsOutputSchema,
          maxRetries: 3, // ride out transient free-tier 429s before discarding
          prompt: buildFlashcardsPrompt({
            chunkContent: chunk.content,
            sectionTitle: chunk.section_title,
            count: FLASHCARDS.CARDS_PER_CALL,
          }),
        })
        usage.calls += 1
        usage.promptTokens += result.usage?.inputTokens ?? 0
        usage.completionTokens += result.usage?.outputTokens ?? 0
        slots[i] = result.object.cards.map((card) => ({
          front: card.term,
          back: card.definition,
          sourcePage: chunk.page_number,
          sourceSection: chunk.section_title,
        }))
      } catch (err) {
        console.error(
          `[flashcards] call ${i + 1}/${picked.length} for chunk ${chunk.id} discarded:`,
          err instanceof Error ? err.message : err,
        )
      }
      done += 1
      await onCall?.(done, picked.length)
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PIPELINE.GENERATION_CONCURRENCY, picked.length) }, worker),
  )
  const cards = dedupeCards(slots.flat()).slice(0, FLASHCARDS.MAX_TOTAL)

  console.log(
    `[flashcards] usage: calls=${usage.calls} prompt_tokens=${usage.promptTokens} completion_tokens=${usage.completionTokens} cards=${cards.length}`,
  )
  return { cards, usage }
}
