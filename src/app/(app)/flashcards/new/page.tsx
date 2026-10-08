import type { Metadata } from 'next'
import { CreateReviewerForm } from '@/components/CreateReviewerForm'
import { CreateScreenShell } from '@/components/CreateScreenShell'

export const metadata: Metadata = { title: 'New Flashcard Deck' }

/**
 * The deck entrance: same creation flow and same reviewer row as the question
 * flow, pre-set to 'flashcards_only' so the process reads as upload -> cards.
 */
export default function NewDeckPage() {
  return (
    <CreateScreenShell
      backHref="/dashboard"
      title="New flashcard deck"
      subtitle="Upload your material once — we read it end to end and hand back a printable cut-and-fold deck."
      variant="deck"
    >
      <CreateReviewerForm defaultMode="flashcards_only" showModePicker={false} />
    </CreateScreenShell>
  )
}
