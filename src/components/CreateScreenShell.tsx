import Link from 'next/link'
import type { ReactNode } from 'react'
import { FLASHCARDS, LIMITS } from '@/lib/constants'

/**
 * Full-width shell for the two creation screens. The form keeps a readable
 * column; the space that used to sit empty on wide monitors now carries the
 * context people actually ask about at this moment: what happens after the
 * upload, what the limits are, and what we do with the file.
 */
export function CreateScreenShell({
  backHref,
  title,
  subtitle,
  variant,
  children,
}: {
  backHref: string
  title: string
  subtitle: string
  /** Which deliverable this entrance builds - drives the aside copy. */
  variant: 'questions' | 'deck'
  children: ReactNode
}) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
      <div className="mx-auto w-full max-w-3xl xl:mx-0">
        <div className="mb-6">
          <Link href={backHref} className="text-sm text-muted hover:text-foreground">
            ← Back to dashboard
          </Link>
          <h1 className="mt-2 font-display text-2xl font-extrabold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
        </div>
        <div className="rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70">
          {children}
        </div>
      </div>

      <aside className="mx-auto w-full max-w-3xl space-y-4 text-sm xl:mx-0">
        <section className="rounded-card border border-line bg-surface/60 p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted">
            How it works
          </h2>
          {variant === 'questions' ? (
            <ol className="mt-3 space-y-3">
              {[
                ['Reading', 'We pull the text out of your file and score whether it is usable.'],
                ['Your check', 'You confirm the extracted material reads right before any AI budget is spent.'],
                ['Generating', 'Questions come only from your material and pass source checks; anything that can\u2019t be grounded is dropped, never invented.'],
                ['Studying', 'Answer, score, and review every attempt — with the exact passage behind each question.'],
              ].map(([step, text], i) => (
                <li key={step} className="flex gap-3">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand"
                  >
                    {i + 1}
                  </span>
                  <p>
                    <span className="font-semibold">{step}.</span>{' '}
                    <span className="text-muted">{text}</span>
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="mt-3 space-y-3">
              {[
                ['Reading', 'We pull the text out of your file and score whether it is usable.'],
                ['Building', 'We read the whole document spread-by-spread and write the cards straight from your material.'],
                ['Passing your check', 'Every definition must be answerable from your own text — if a passage can\u2019t support a card, we skip it instead of inventing one.'],
                ['Printing', 'Cut along the dashes, fold, tape. Both sides of each card read correctly.'],
              ].map(([step, text], i) => (
                <li key={step} className="flex gap-3">
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand"
                  >
                    {i + 1}
                  </span>
                  <p>
                    <span className="font-semibold">{step}.</span>{' '}
                    <span className="text-muted">{text}</span>
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-card border border-line bg-surface/60 p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted">
            Good to know
          </h2>
          <ul className="mt-3 space-y-2 text-muted">
            <li>
              PDF and DOCX with real text, up to {LIMITS.MAX_FILE_SIZE_LABEL}. Photos and
              scanned images can&rsquo;t be grounded in exact text, so they&rsquo;re not supported yet.
            </li>
            <li>
              {variant === 'questions'
                ? `Up to ${LIMITS.MAX_QUESTIONS_PER_GENERATION} questions per reviewer.`
                : `A deck is capped at ${FLASHCARDS.MAX_TOTAL} cut-out cards, so a long PDF costs the same as a short one.`}
            </li>
            <li>
              {variant === 'questions'
                ? 'Every ready reviewer also gets a printable flashcard deck on demand.'
                : 'Decks print best single-sided on card stock.'}
            </li>
          </ul>
        </section>

        <section className="rounded-card border border-line bg-surface/60 p-5">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted">
            Your file stays yours
          </h2>
          <p className="mt-3 text-muted">
            It is processed by an AI provider only to build {variant === 'questions' ? 'your reviewer' : 'your deck'} —
            never to train models, never shown to anyone else. Deleting this {variant === 'questions' ? 'reviewer' : 'deck'} deletes
            the file and its extracted text.{' '}
            <Link href="/privacy" className="font-semibold text-brand hover:underline">
              Privacy &amp; terms
            </Link>
          </p>
        </section>
      </aside>
    </div>
  )
}
