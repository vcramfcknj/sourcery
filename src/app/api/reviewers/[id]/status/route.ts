import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { getUser } from '@/lib/auth'
import { getReviewerStatus } from '@/lib/data/reviewers'
import { drainQueue } from '@/lib/jobs/drain'

// The drain callback fires after the response and can legitimately run for
// up to a job's worst-case wall time (extraction ~90s, generation up to 3
// minutes). Vercel Hobby caps functions at 300s; stating it here keeps the
// intent explicit and survives any future default changes.
export const maxDuration = 300

/**
 * GET /api/reviewers/[id]/status - the processing screen polls this (PRD 29.3)
 * for the real reviewer status + job stage. Ownership is enforced by RLS via
 * getReviewerStatus; a foreign id returns 404, never another user's progress.
 *
 * This route is ALSO the serverless queue pump. Every poll fires
 * `after(() => drainQueue())`, which is what makes Vercel's free tier work
 * without an always-on worker: the 2s poll loop from ProcessingScreen
 * doubles as the durability mechanism. If a job ever gets stuck mid-handler,
 * the next poll (2s later, new function instance, fresh 300s budget) picks
 * it up as soon as pg-boss moves it out of 'active'.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const status = await getReviewerStatus(id)
  if (!status) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  after(() => drainQueue().catch((err) => console.error('[after:status-drain]', err)))
  return NextResponse.json(status)
}
