import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getReviewer, getVerifyData, getReadyData } from '@/lib/data/reviewers'
import { IN_PROGRESS_STATUSES } from '@/lib/constants'
import { ProcessingScreen } from '@/components/ProcessingScreen'
import { VerifyMaterial } from '@/components/VerifyMaterial'
import { ReviewerReady } from '@/components/ReviewerReady'

export const metadata: Metadata = { title: 'Reviewer' }

/**
 * Reviewer detail (PRD 28.4): a single route that branches on the reviewer's
 * lifecycle status into the right screen. Phase 2 covers uploaded ->
 * processing -> awaiting_verification -> failed; later phases extend the tree
 * (generating/ready/results).
 */
export default async function ReviewerDetailPage({
  params,
}: {
  params: Promise<{ reviewerId: string }>
}) {
  await requireUser() // ownership is still enforced by RLS on every read below
  const { reviewerId } = await params
  const reviewer = await getReviewer(reviewerId)
  if (!reviewer) notFound()

  // Awaiting verification: show what we detected for the user to confirm.
  if (reviewer.status === 'awaiting_verification') {
    const data = await getVerifyData(reviewerId)
    if (!data) notFound()
    return <VerifyMaterial data={data} />
  }

  // Generated: show the real question count, coverage and mix (PRD 25).
  if (reviewer.status === 'ready') {
    // A deck-mode reviewer's deliverable IS the printable deck: one screen,
    // no "0 questions" dead end.
    if (reviewer.mode === 'flashcards_only') {
      redirect(`/reviewers/${reviewerId}/flashcards`)
    }
    const data = await getReadyData(reviewerId)
    if (!data) notFound()
    return <ReviewerReady data={data} />
  }

  // Generating / validating: the polling screen shows the real generation
  // stages the worker wrote (planning -> generating -> validating -> selecting).
  if (reviewer.status === 'generating' || reviewer.status === 'validating') {
    return <ProcessingScreen reviewerId={reviewerId} />
  }

  // In-progress (uploaded/processing/extracting/structuring) or failed:
  // the polling screen shows real progress or the actionable error.
  if (IN_PROGRESS_STATUSES.includes(reviewer.status) || reviewer.status === 'failed') {
    return <ProcessingScreen reviewerId={reviewerId} />
  }

  return <ProcessingScreen reviewerId={reviewerId} />
}
