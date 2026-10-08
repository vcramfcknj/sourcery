'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth'
import { getFlashcards, getReviewerChunks } from '@/lib/data/flashcards'
import { generateFlashcards } from '@/lib/pipeline/flashcards'
import { replaceDeckCards } from '@/lib/pipeline/deck-store'

/**
 * Generate (or regenerate) a printable flashcard deck for a reviewer.
 * Trial module: runs inline in the web request (no worker job) because it is
 * a bounded, user-initiated side-generation - at most FLASHCARDS.MAX_CHUNKS
 * AI calls. Ownership is enforced by reading chunks/documents through the
 * RLS-scoped user client first: another user's reviewer yields zero chunks,
 * so nothing is generated and nothing is written.
 */
export async function generateFlashcardsAction(
  reviewerId: string,
  regenerate = false,
): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    await requireUser()

    if (!regenerate) {
      const existing = await getFlashcards(reviewerId)
      if (existing.length > 0) return { ok: true, count: existing.length }
    }

    const chunks = await getReviewerChunks(reviewerId)
    if (chunks.length === 0) {
      return {
        ok: false,
        count: 0,
        error: 'This reviewer has no extracted text to make cards from yet.',
      }
    }

    const { cards } = await generateFlashcards(chunks)
    if (cards.length === 0) {
      return {
        ok: false,
        count: 0,
        error:
          'We could not build reliable cards from this material - every card must be answerable from your own text, and we found none that cleared that bar.',
      }
    }

    const stored = await replaceDeckCards(reviewerId, cards)
    if (!stored.ok) return { ok: false, count: 0, error: stored.error }

    revalidatePath(`/reviewers/${reviewerId}/flashcards`)
    return { ok: true, count: stored.count }
  } catch (err) {
    return {
      ok: false,
      count: 0,
      error: err instanceof Error ? 'Something went wrong building the deck. Please try again.' : 'Something went wrong.',
    }
  }
}
