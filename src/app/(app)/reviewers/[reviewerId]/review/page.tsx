import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { startOrResumeReview } from '@/lib/data/attempts'
import { ReviewScreen } from '@/components/review/ReviewScreen'

export const metadata: Metadata = { title: 'Review' }

/**
 * Review route (PRD 21, 28.4: /reviewers/[id]/review). Server component that
 * creates or resumes the single in-progress attempt (PRD 9.1/21.5) and hands
 * the client a payload that contains no answers (PRD 21.2). Anything that
 * isn't a ready reviewer bounces back to the detail screen, which already
 * branches to the right state (processing / verify / failed).
 */
export default async function ReviewPage({
  params,
}: {
  params: Promise<{ reviewerId: string }>
}) {
  await requireUser() // reads below are RLS-scoped to this user regardless
  const { reviewerId } = await params
  const result = await startOrResumeReview(reviewerId)
  if (!result.ok) redirect(`/reviewers/${reviewerId}`)
  return <ReviewScreen session={result.session} />
}
