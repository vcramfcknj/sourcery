'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { AnswerReview, AnswerReviewItem } from '@/lib/data/results'
import { REPORT_REASONS } from '@/lib/constants'
import { reportQuestionAction } from '@/app/actions/attempts'

/**
 * Answer review (PRD 23), reachable only for a COMPLETED attempt. This is the
 * one place the correct answer, explanation and source evidence are sent to
 * the browser - the review flow (PRD 21.2) never does. Questions appear in the
 * same per-attempt order the user answered them (PRD 24.1). View Source opens
 * the evidence passage with the quoted sentence highlighted (PRD 23.2), and
 * every question has a Report action (PRD 23.4). Correctness uses an icon plus
 * a text label, never colour alone.
 */

function locator(item: AnswerReviewItem): string {
  const parts: string[] = []
  if (item.source.page != null) parts.push(`Page ${item.source.page}`)
  if (item.source.section) parts.push(item.source.section)
  return parts.length > 0 ? parts.join(' · ') : 'Your material'
}

/** Split the passage around the quote so the evidence can be highlighted. */
function highlightQuote(passage: string, quote: string): { before: string; hit: string; after: string } | null {
  const idx = quote ? passage.indexOf(quote) : -1
  if (idx === -1) return null
  return { before: passage.slice(0, idx), hit: quote, after: passage.slice(idx + quote.length) }
}

function OptionRow({ option, item }: { option: string; item: AnswerReviewItem }) {
  const isCorrect = option === item.correctAnswer
  const isChosen = option === item.userAnswer
  let badge: { text: string; tone: string } | null = null
  if (isCorrect) badge = { text: 'Correct answer', tone: 'text-success' }
  else if (isChosen) badge = { text: 'Your answer', tone: 'text-danger' }

  return (
    <li
      className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${
        isCorrect
          ? 'border-success/50 bg-success/5'
          : isChosen
            ? 'border-danger/50 bg-danger/5'
            : 'border-line bg-background'
      }`}
    >
      <span className={isChosen || isCorrect ? 'font-medium' : ''}>{option}</span>
      {badge && (
        <span className={`flex shrink-0 items-center gap-1 text-xs font-semibold ${badge.tone}`}>
          {isCorrect ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="m20 6-11 11-5-5" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          )}
          {badge.text}
        </span>
      )}
    </li>
  )
}

function ReportDialog({
  questionId,
  onClose,
}: {
  questionId: string
  onClose: () => void
}) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0])
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  async function submit() {
    setState('sending')
    const res = await reportQuestionAction(questionId, reason, note)
    setState(res.ok ? 'sent' : 'error')
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center sm:pb-0"
      // Backdrop click dismisses, like any modal (target is the overlay itself
      // only when the user did NOT click inside the dialog panel).
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
        className="anim-fade w-full max-w-md rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70"
      >
        <h2 id="report-title" className="font-display text-lg font-bold">
          Report this question
        </h2>
        {state === 'sent' ? (
          <>
            <p className="mt-2 text-sm text-muted">
              Thanks — we&apos;ll review this against your material. It stays in your reviewer
              unless you delete it.
            </p>
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <fieldset className="mt-4">
              <legend className="text-sm font-medium">What&apos;s wrong with it?</legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {REPORT_REASONS.map((r) => (
                  <label key={r} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-background">
                    <input
                      type="radio"
                      name="report-reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="h-4 w-4 accent-[var(--color-brand)]"
                    />
                    {r}
                  </label>
                ))}
              </div>
            </fieldset>
            <label htmlFor="report-note" className="mt-3 block text-sm font-medium">
              Note <span className="text-muted">(optional)</span>
            </label>
            <textarea
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm"
              placeholder="Add anything that helps us understand the issue."
            />
            {state === 'error' && (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">
                Could not submit your report. Please try again.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-background"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={state === 'sending'}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
              >
                {state === 'sending' ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function QuestionCard({
  item,
  number,
  onReport,
}: {
  item: AnswerReviewItem
  number: number
  onReport: () => void
}) {
  const [sourceOpen, setSourceOpen] = useState(false)
  const highlighted = highlightQuote(item.source.passage, item.source.quote)

  return (
    <section
      className={`rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 ${
        item.isCorrect ? '' : 'ring-danger/30'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Question {number}</p>
        <span
          className={`flex items-center gap-1 text-sm font-semibold ${
            item.skipped ? 'text-warning' : item.isCorrect ? 'text-success' : 'text-danger'
          }`}
        >
          {item.skipped ? 'Skipped' : item.isCorrect ? 'Correct' : 'Incorrect'}
        </span>
      </div>

      <h2 className="mt-2 font-display text-base font-bold leading-snug sm:text-lg">{item.prompt}</h2>

      {item.skipped && (
        <p className="mt-2 text-sm text-warning">You didn&apos;t answer this — it counted as incorrect.</p>
      )}

      {item.options.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {item.options.map((option) => (
            <OptionRow key={option} option={option} item={item} />
          ))}
        </ul>
      ) : (
        // Identification: no options — show the typed answer vs the expected term.
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <div
            className={`rounded-2xl border px-4 py-3 ${
              item.isCorrect ? 'border-success/50 bg-success/5' : 'border-danger/50 bg-danger/5'
            }`}
          >
            <span className="text-muted">Your answer: </span>
            <span className="font-medium">
              {item.userAnswer && item.userAnswer.trim() ? item.userAnswer : '— (not answered)'}
            </span>
          </div>
          {!item.isCorrect && (
            <div className="rounded-2xl border border-success/50 bg-success/5 px-4 py-3">
              <span className="text-muted">Correct answer: </span>
              <span className="font-medium">{item.correctAnswer}</span>
            </div>
          )}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-background px-4 py-3 text-sm">
        <p className="font-semibold">Explanation</p>
        <p className="mt-1 text-foreground/90">{item.explanation}</p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <p className="text-muted">
          Source: <span className="font-medium text-foreground">{locator(item)}</span>
        </p>
        <button
          type="button"
          onClick={() => setSourceOpen((o) => !o)}
          aria-expanded={sourceOpen}
          className="shrink-0 rounded-full border border-line bg-surface px-3 py-1.5 font-semibold text-brand transition hover:bg-background"
        >
          {sourceOpen ? 'Hide source' : 'View Source'}
        </button>
      </div>

      {sourceOpen && (
        <div className="mt-2 rounded-xl border border-line bg-background px-4 py-3 text-sm leading-relaxed">
          {highlighted ? (
            <p className="text-foreground/90">
              {highlighted.before}
              <mark className="rounded bg-periwinkle-soft px-0.5 text-foreground">{highlighted.hit}</mark>
              {highlighted.after}
            </p>
          ) : (
            <>
              <p className="text-foreground/90">{item.source.passage}</p>
              <p className="mt-2 text-xs text-muted">
                Quoted evidence: “{item.source.quote}”
              </p>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onReport}
        className="mt-4 text-sm font-medium text-muted underline transition hover:text-foreground"
      >
        Report this question
      </button>
    </section>
  )
}

export function AnswerReviewScreen({ review }: { review: AnswerReview }) {
  const [reportingId, setReportingId] = useState<string | null>(null)

  return (
    <main className="mx-auto max-w-3xl pb-16">
      <header className="mb-6">
        <Link
          href={`/reviewers/${review.reviewerId}/results?attempt=${review.attemptId}`}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Back to results
        </Link>
        <h1 className="mt-2 font-display text-2xl font-extrabold">Answer review</h1>
        <p className="mt-1 text-sm text-muted">
          {review.reviewerName} · {review.correct} of {review.total} correct ({review.percentage}%)
        </p>
      </header>

      <div className="flex flex-col gap-5">
        {review.items.map((item, i) => (
          <QuestionCard
            key={item.id}
            item={item}
            number={i + 1}
            onReport={() => setReportingId(item.id)}
          />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link
          href={`/reviewers/${review.reviewerId}/review`}
          className="flex-1 rounded-full bg-brand px-6 py-3 text-center font-semibold text-white shadow-soft transition hover:bg-brand-hover"
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

      {reportingId && (
        <ReportDialog questionId={reportingId} onClose={() => setReportingId(null)} />
      )}
    </main>
  )
}
