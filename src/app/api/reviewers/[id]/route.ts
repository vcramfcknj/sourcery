import { NextResponse } from 'next/server'
import { getUser } from '@/lib/auth'
import { deleteReviewer } from '@/lib/data/reviewers'

/**
 * DELETE /api/reviewers/[id] - hard delete with full storage cleanup
 * (PRD 26.3/27.4). Ownership is enforced by RLS inside deleteReviewer;
 * an id belonging to another user simply resolves to "not found".
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const result = await deleteReviewer(id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
