import { createAdminClient } from '../supabase/admin'
import type { GeneratedFlashcard } from './flashcards'

/**
 * The single write path for a reviewer's stored deck: delete-then-insert so a
 * retry or a regenerate can never leave duplicate/ghost cards (PRD 13.2), with
 * `order_index` reflecting the final card order.
 *
 * Deliberately NOT marked `server-only`: both the web server action (trial
 * deck on a question reviewer) and the pg-boss worker (deck-mode reviewers)
 * write decks, and the worker runs in a plain Node runtime. Ownership is the
 * caller's job - the web action reads chunks through the RLS-scoped client
 * first, the worker is a trusted system actor scoped to one reviewer id.
 */
export async function replaceDeckCards(
  reviewerId: string,
  cards: GeneratedFlashcard[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const admin = createAdminClient()

  const { error: delErr } = await admin.from('flashcards').delete().eq('reviewer_id', reviewerId)
  if (delErr) {
    console.error('[deck] delete failed:', delErr.message)
    return { ok: false, error: 'Could not rebuild the deck. Please try again.' }
  }

  if (cards.length === 0) return { ok: true, count: 0 }

  const rows = cards.map((card, i) => ({
    reviewer_id: reviewerId,
    order_index: i,
    front: card.front,
    back: card.back,
    source_page: card.sourcePage,
    source_section: card.sourceSection,
  }))
  const { error: insErr } = await admin.from('flashcards').insert(rows)
  if (insErr) {
    console.error('[deck] insert failed:', insErr.message)
    return { ok: false, error: 'Could not save the deck. Please try again.' }
  }
  return { ok: true, count: rows.length }
}
