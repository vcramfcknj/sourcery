import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { getReviewerStatus } from '@/lib/data/reviewers'

/**
 * GET /api/reviewers/[id]/status - the processing screen polls this (PRD 29.3)
 * for the real reviewer status + job stage. Ownership is enforced by RLS via
 * getReviewerStatus; a foreign id returns 404, never another user's progress.
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

  return NextResponse.json(status)
}
