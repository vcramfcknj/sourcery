import Link from 'next/link'
import type { AttemptSummary } from '@/lib/data/results'

/**
 * Results page (PRD 22), shown only after an attempt is completed. The score,
 * correct/incorrect and percentage are all computed server-side upstream -
 * this component only renders them. Correctness is conveyed with an icon AND
 * a text label, never colour alone (PRD 22 accessibility). Primary CTA is
 * Review Answers; Retake starts a fresh attempt via the review route.
 */

function headline(pct: number): string {
  if (pct >= 90) return 'Outstanding work.'
  if (pct >= 70) return 'Great work.'
  if (pct >= 50) return 'Solid progress — keep going.'
  return 'Plenty of room to grow — review the answers.'
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m20 6-11 11-5-5" />
    </svg>
  )
}
function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}
function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function ResultsScreen({ summary }: { summary: AttemptSummary }) {
  const {
    attemptId,
    reviewerId,
    reviewerName,
    total,
    correct,
    incorrect,
    skipped,
    percentage,
  } = summary
  const answeredIncorrect = incorrect - skipped

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-6 pb-16 lg:grid-cols-2 lg:items-start">
      <header className="text-center lg:col-span-2 lg:text-left">
        <p className="text-sm text-muted">{reviewerName}</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold">Your Results</h1>
      </header>

      <section className="rounded-card bg-surface p-8 text-center shadow-card ring-1 ring-line/70">
        <p className="font-display text-5xl font-extrabold text-brand">
          {correct} / {total}
        </p>
        <p className="mt-1 text-lg font-semibold text-foreground">{percentage}%</p>
        <p className="mt-3 text-sm text-muted">{headline(percentage)}</p>

        {/* Primary CTA first (PRD 29.2): Review Answers. */}
        <div className="mt-7 flex flex-col gap-3">
          <Link
            href={`/reviewers/${reviewerId}/answers?attempt=${attemptId}`}
            className="rounded-full bg-brand px-6 py-3 text-center font-semibold text-white shadow-soft transition hover:bg-brand-hover"
          >
            Review Answers
          </Link>
          <div className="flex gap-3">
            <Link
              href={`/reviewers/${reviewerId}/review`}
              className="flex-1 rounded-full border border-line bg-surface px-6 py-3 text-center font-semibold transition hover:bg-background"
            >
              Retake
            </Link>
            <Link
              href="/dashboard"
              className="flex-1 rounded-full border border-line bg-surface px-6 py-3 text-center font-semibold text-muted transition hover:bg-background"
            >
              Back to dashboard
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-card bg-surface p-8 shadow-card ring-1 ring-line/70">
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted">
          Breakdown
        </h2>
        {/* Icon + text label, colour is supplementary only. */}
        <dl className="mt-5 flex flex-col gap-2 text-left">
          <div className="flex items-center justify-between rounded-xl bg-success/10 px-4 py-2.5 text-success">
            <dt className="flex items-center gap-2 font-medium">
              <CheckIcon /> Correct
            </dt>
            <dd className="font-bold tabular-nums">{correct}</dd>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-danger/10 px-4 py-2.5 text-danger">
            <dt className="flex items-center gap-2 font-medium">
              <CrossIcon /> Incorrect
            </dt>
            <dd className="font-bold tabular-nums">
              {incorrect}
              {skipped > 0 && (
                <span className="ml-1 text-xs font-normal opacity-80">
                  {answeredIncorrect} wrong, {skipped} skipped
                </span>
              )}
            </dd>
          </div>
          {skipped > 0 && (
            <div className="flex items-center justify-between rounded-xl bg-warning/10 px-4 py-2.5 text-warning">
              <dt className="flex items-center gap-2 font-medium">
                <SkipIcon /> Skipped (counted incorrect)
              </dt>
              <dd className="font-bold tabular-nums">{skipped}</dd>
            </div>
          )}
        </dl>
      </section>
    </main>
  )
}
