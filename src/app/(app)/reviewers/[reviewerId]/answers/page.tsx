import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getAnswerReview, getLatestCompletedAttemptId } from '@/lib/data/results'
import { AnswerReviewScreen } from '@/components/review/AnswerReviewScreen'

export const metadata: Metadata = { title: 'Answer review' }

/**
 * Answer review route (PRD 28.4: /reviewers/[id]/answers). Reveals the correct
 * answers, explanations and sources for a COMPLETED attempt only - the same
 * latest-or-selected (?attempt=) resolution as results. An in-progress or
 * unfinished attempt is bounced back to the review so nothing can be peeked at
 * early (PRD 21.2).
 */
export default async function AnswersPage({
  params,
  searchParams,
}: {
  params: Promise<{ reviewerId: string }>
  searchParams: Promise<{ attempt?: string }>
}) {
  await requireUser()
  const { reviewerId } = await params
  const sp = await searchParams

  const attemptId = sp.attempt ?? (await getLatestCompletedAttemptId(reviewerId))
  if (!attemptId) redirect(`/reviewers/${reviewerId}`)

  const res = await getAnswerReview(attemptId)
  if (!res.ok) {
    if (res.reason === 'in_progress') redirect(`/reviewers/${reviewerId}/review`)
    return (
      <main className="mx-auto max-w-xl py-16 text-center">
        <h1 className="font-display text-xl font-bold">Finish your review first</h1>
        <p className="mt-2 text-sm text-muted">
          Answers and sources appear once you complete the review.
        </p>
        <Link
          href={`/reviewers/${reviewerId}/review`}
          className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-soft hover:bg-brand-hover"
        >
          Go to review
        </Link>
      </main>
    )
  }
  return <AnswerReviewScreen review={res.value} />
}
