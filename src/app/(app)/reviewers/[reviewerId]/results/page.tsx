import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { getResults, getLatestCompletedAttemptId } from '@/lib/data/results'
import { ResultsScreen } from '@/components/review/ResultsScreen'

export const metadata: Metadata = { title: 'Your results' }

/**
 * Results route (PRD 28.4: /reviewers/[id]/results). Shows the latest - or a
 * specifically selected (?attempt=) - COMPLETED attempt. Results only ever
 * appear after completion (PRD 22): an in-progress attempt is bounced back to
 * the review, and a reviewer with no finished attempt returns to its detail
 * screen. All scoring is read from the server-computed attempt row.
 */
export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ reviewerId: string }>
  searchParams: Promise<{ attempt?: string }>
}) {
  await requireUser() // every read below is RLS-scoped to this user regardless
  const { reviewerId } = await params
  const sp = await searchParams

  const attemptId = sp.attempt ?? (await getLatestCompletedAttemptId(reviewerId))
  if (!attemptId) redirect(`/reviewers/${reviewerId}`)

  const res = await getResults(attemptId)
  if (!res.ok) {
    if (res.reason === 'in_progress') redirect(`/reviewers/${reviewerId}/review`)
    redirect(`/reviewers/${reviewerId}`)
  }
  return <ResultsScreen summary={res.value} />
}
