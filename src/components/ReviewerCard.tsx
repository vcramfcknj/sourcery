'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReviewerCard as ReviewerCardData } from '@/lib/types'
import { IN_PROGRESS_STATUSES } from '@/lib/constants'
import { useDismissOnOutside } from '@/lib/useDismissOnOutside'
import { OriginalFileButton } from '@/components/OriginalFileButton'

// Grace window before a confirmed deletion is actually sent. Long enough to
// react to an accidental click, short enough that nobody waits around for it.
const GRACE_SECONDS = 10

/**
 * Dashboard reviewer card (PRD 9) with the state -> button mapping decided
 * in PRD 9.1. Actions beyond Phase 1 (progress/error/detail screens) route
 * to /reviewers/[id], which branches on status in Phase 2.
 */
export function ReviewerCard({ card }: { card: ReviewerCardData }) {
  const { reviewer, sourceFileName, lastAttemptedAt, latestScore, hasInProgressAttempt, flashcardCount } =
    card
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Separate slot: a failed "open original" must not leak into the delete
  // dialog's error display (different action, different retry path).
  const [fileError, setFileError] = useState<string | null>(null)
  // Seconds left in the undo window; null = no deletion pending.
  const [graceLeft, setGraceLeft] = useState<number | null>(null)
  // Dismiss the options popover on outside click / Escape like any menu.
  const menuRef = useDismissOnOutside<HTMLDivElement>(menuOpen, () => setMenuOpen(false))

  const isWorking = IN_PROGRESS_STATUSES.includes(reviewer.status)
  // A deck is the same reviewer row in another mode: its deliverable is the
  // printable deck, so its card counts cards, not questions.
  const isDeck = reviewer.mode === 'flashcards_only'

  // PRD 9.1 mapping
  let cta: { label: string; href: string }
  if (reviewer.status === 'failed') {
    cta = { label: 'Fix issue', href: `/reviewers/${reviewer.id}?view=error` }
  } else if (isWorking) {
    cta = { label: 'View progress', href: `/reviewers/${reviewer.id}?view=progress` }
  } else if (reviewer.status === 'awaiting_verification') {
    cta = { label: 'Verify material', href: `/reviewers/${reviewer.id}` }
  } else if (isDeck && reviewer.status === 'ready') {
    cta = { label: 'Open deck', href: `/reviewers/${reviewer.id}/flashcards` }
  } else if (hasInProgressAttempt) {
    cta = { label: 'Continue', href: `/reviewers/${reviewer.id}/review` }
  } else if (reviewer.status === 'ready' && !lastAttemptedAt) {
    cta = { label: 'Start', href: `/reviewers/${reviewer.id}/review` }
  } else {
    cta = { label: 'Retake', href: `/reviewers/${reviewer.id}/review` }
  }

  // The grace countdown. Each tick is a 1s timeout; hitting 0 fires the real
  // DELETE. Navigating away or closing the tab unmounts the card, which
  // CLEARS the timer - so an abandoned deletion simply never happens (the
  // safe direction: nothing is removed without the user watching).
  useEffect(() => {
    if (graceLeft === null) return
    if (graceLeft === 0) {
      let cancelled = false
      void (async () => {
        setDeleting(true)
        const res = await fetch(`/api/reviewers/${reviewer.id}`, { method: 'DELETE' })
        if (cancelled) return
        setDeleting(false)
        setGraceLeft(null)
        if (res.ok) {
          router.refresh()
        } else {
          // Re-open the confirmation with the error so the user can retry.
          setDeleteError('Could not delete this reviewer. Please try again.')
          setConfirmOpen(true)
        }
      })()
      return () => {
        cancelled = true
      }
    }
    const t = setTimeout(() => setGraceLeft((s) => (s === null ? s : s - 1)), 1000)
    return () => clearTimeout(t)
  }, [graceLeft, reviewer.id, router])

  return (
    <li
      aria-busy={graceLeft !== null || deleting || undefined}
      className={`relative flex flex-col rounded-card bg-surface p-5 shadow-card ring-1 ring-line/70 transition duration-200 hover:-translate-y-0.5 ${
        graceLeft !== null || deleting ? 'opacity-60' : ''
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-8">
        <h3 className="font-display text-lg font-bold leading-snug break-words">
          {reviewer.name}
        </h3>
      </div>

      {isDeck && (
        <p className="mb-1">
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
            Flashcard deck
          </span>
        </p>
      )}

      {sourceFileName && (
        <p className="truncate text-sm text-muted" title={sourceFileName}>
          {sourceFileName}
        </p>
      )}

      <p className="mt-2 text-sm text-muted">
        {reviewer.status === 'ready'
          ? isDeck
            ? `${flashcardCount} card${flashcardCount === 1 ? '' : 's'} ready to print`
            : `${reviewer.question_count} question${reviewer.question_count === 1 ? '' : 's'}`
          : isWorking
            ? isDeck
              ? 'Building your deck…'
              : 'Building your reviewer…'
            : reviewer.status === 'awaiting_verification'
              ? 'Waiting for you to verify the material'
              : 'Needs attention'}
      </p>

      <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {latestScore && (
          <div>
            <dt className="sr-only">Last score</dt>
            <dd>
              Last score:{' '}
              <span className="font-medium text-foreground">
                {latestScore.score}/{latestScore.total}
              </span>
            </dd>
          </div>
        )}
        {lastAttemptedAt && (
          <div>
            <dt className="sr-only">Last studied</dt>
            <dd>
              Last studied:{' '}
              <span className="font-medium text-foreground">
                {new Date(lastAttemptedAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </dd>
          </div>
        )}
        <div>
          <dt className="sr-only">Created</dt>
          <dd>
            Created{' '}
            <span className="font-medium text-foreground">
              {new Date(reviewer.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center gap-2" ref={menuRef}>
        <Link
          href={cta.href}
          className="flex-1 rounded-full bg-brand px-4 py-2 text-center text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover"
        >
          {cta.label}
        </Link>
        <button
          type="button"
          aria-label="More options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted transition hover:bg-background"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden fill="currentColor">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-4 top-14 z-10 w-44 rounded-2xl border border-line bg-surface p-1.5 shadow-card"
          >
            {latestScore && (
              <Link
                href={`/reviewers/${reviewer.id}/results`}
                role="menuitem"
                className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-background"
              >
                View results
              </Link>
            )}
            <span role="menuitem">
              <OriginalFileButton
                reviewerId={reviewer.id}
                variant="menu"
                label="Open or download original"
                onDone={() => setMenuOpen(false)}
                onError={(msg) => setFileError(msg)}
              />
            </span>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false)
                setDeleteError(null)
                setConfirmOpen(true)
              }}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-danger hover:bg-background"
            >
              {isDeck ? 'Delete deck' : 'Delete reviewer'}
            </button>
          </div>
        )}
      </div>

      {confirmOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center sm:pb-0"
            // Backdrop click / Escape dismiss (never deletes) unless a
            // delete request is in flight.
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !deleting) setConfirmOpen(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !deleting) setConfirmOpen(false)
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-reviewer-title"
              className="anim-fade w-full max-w-md rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70"
            >
              <h2 id="delete-reviewer-title" className="font-display text-lg font-bold text-danger">
                Delete “{reviewer.name}”?
              </h2>
              <p className="mt-2 text-sm text-muted">
                {isDeck
                  ? 'Its material and every card are removed permanently. This can’t be undone.'
                  : 'Its material, questions, and attempts are removed permanently. This can’t be undone.'}
              </p>
              {deleteError && (
                <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
                  {deleteError}
                </p>
              )}
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  autoFocus
                  disabled={deleting}
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-background disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Don't delete yet - start the undo countdown instead.
                    setConfirmOpen(false)
                    setDeleteError(null)
                    setGraceLeft(GRACE_SECONDS)
                  }}
                  className="rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete permanently
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Undo window: the delete only reaches the server when the countdown
          ends. Portalled like the dialog to escape the card's hover transform. */}
      {graceLeft !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,26rem)] -translate-x-1/2">
            <div className="anim-fade rounded-card bg-surface p-4 shadow-card ring-1 ring-line/70">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">Deleting “{reviewer.name}”</p>
                  <p className="text-xs text-muted">
                    {deleting
                      ? 'Removing for good…'
                      : `Gone for good in ${graceLeft}s unless you undo.`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setGraceLeft(null)}
                  disabled={deleting}
                  className="shrink-0 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition hover:bg-background disabled:opacity-60"
                >
                  Undo
                </button>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-line/60">
                <div
                  className="h-full rounded-full bg-danger motion-safe:transition-[width] motion-safe:duration-1000 motion-safe:ease-linear"
                  style={{ width: `${(graceLeft / GRACE_SECONDS) * 100}%` }}
                />
              </div>
            </div>
          </div>,
          document.body
        )}

      {fileError && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {fileError}
        </p>
      )}
    </li>
  )
}
