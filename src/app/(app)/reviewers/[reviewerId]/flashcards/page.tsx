import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getReviewer } from '@/lib/data/reviewers'
import { getFlashcards } from '@/lib/data/flashcards'
import { FlashcardsDeck } from '@/components/flashcards/FlashcardsDeck'

export const metadata: Metadata = { title: 'Printable flashcards' }

/**
 * Printable flashcards route (trial module):
 * /reviewers/[id]/flashcards. Ownership is RLS-enforced by getReviewer -
 * another user's reviewer simply 404s.
 */
export default async function FlashcardsPage({
  params,
}: {
  params: Promise<{ reviewerId: string }>
}) {
  await requireUser()
  const { reviewerId } = await params
  const reviewer = await getReviewer(reviewerId)
  if (!reviewer) notFound()

  const cards = await getFlashcards(reviewerId)
  return (
    <FlashcardsDeck
      reviewerId={reviewerId}
      reviewerName={reviewer.name}
      cards={cards}
      // In deck mode the cards are the deliverable, not an add-on screen.
      deckMode={reviewer.mode === 'flashcards_only'}
    />
  )
}
