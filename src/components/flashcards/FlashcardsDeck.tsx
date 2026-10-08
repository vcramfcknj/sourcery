'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { generateFlashcardsAction } from '@/app/actions/flashcards'
import type { Flashcard } from '@/lib/types'

/**
 * Printable flashcard deck (TRIAL module) in the classic med-school format:
 * each card is a cut-out strip with the FRONT on top and the BACK printed
 * UPSIDE-DOWN below the fold line - cut, fold in half, tape, and both sides
 * read correctly. The same layout doubles as the screen preview: the
 * "Readable backs" toggle un-rotates the backs for comfortable on-screen
 * study; printing keeps whichever view you have selected.
 *
 * All app chrome (sidebar, header, toolbar) is print:hidden - see globals.
 *
 * `deckMode` marks a 'flashcards_only' reviewer, where this screen IS the
 * product rather than an extra tab on someone's questions reviewer.
 */
export function FlashcardsDeck({
  reviewerId,
  reviewerName,
  cards,
  deckMode = false,
}: {
  reviewerId: string
  reviewerName: string
  cards: Flashcard[]
  deckMode?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Folded-print orientation by default; the deck is a print artifact.
  const [folded, setFolded] = useState(true)

  function run(regenerate: boolean) {
    setError(null)
    startTransition(async () => {
      const res = await generateFlashcardsAction(reviewerId, regenerate)
      if (!res.ok) setError(res.error ?? 'Could not build the deck. Please try again.')
      router.refresh()
    })
  }

  return (
    <div>
      {/* Toolbar - never printed */}
      <div className="mb-8 print:hidden">
        <Link
          href={deckMode ? '/dashboard' : `/reviewers/${reviewerId}`}
          className="text-sm text-muted hover:text-foreground"
        >
          {deckMode ? '← Back to dashboard' : `← Back to ${reviewerName}`}
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold">
              {deckMode ? reviewerName : 'Printable flashcards'}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {cards.length > 0
                ? `${cards.length} cards from your own material — cut along the dashes, fold, tape.`
                : 'Turn this reviewer’s material into cut-out term/definition cards.'}
              {/* The trial label is for the opt-in side-deck on a question
                  reviewer; a deck-mode reviewer IS the product, not a trial. */}
              {!deckMode && (
                <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
                  trial
                </span>
              )}
            </p>
          </div>
          {cards.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label className="mr-1 flex cursor-pointer select-none items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={folded}
                  onChange={(e) => setFolded(e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand)]"
                />
                Folded orientation
              </label>
              <button
                type="button"
                onClick={() => run(true)}
                disabled={pending}
                className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold transition hover:bg-background disabled:opacity-60"
              >
                {pending ? 'Rebuilding…' : 'Regenerate'}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover"
              >
                Print deck
              </button>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      {cards.length === 0 ? (
        /* Empty state: one click to trial-generate the deck */
        <section className="mx-auto max-w-lg rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center shadow-soft print:hidden">
          <h2 className="font-display text-lg font-bold">No deck yet.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            We scan your material end to end and pull out the terms and facts worth
            memorizing — every definition comes from your own document, never from
            general knowledge.
          </p>
          <button
            type="button"
            onClick={() => run(false)}
            disabled={pending}
            className="mt-6 inline-block rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-soft transition hover:bg-brand-hover disabled:opacity-60"
          >
            {pending ? 'Brewing your deck…' : 'Generate flashcards'}
          </button>
          {pending && (
            <p className="mt-2 text-xs text-muted" aria-live="polite">
              This reads through your whole document — usually under a minute.
            </p>
          )}
        </section>
      ) : (
        <>
          <ul className="grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
            {cards.map((card) => (
              <li
                key={card.id}
                className="break-inside-avoid overflow-hidden rounded-2xl border-2 border-dashed border-neutral-300 bg-white text-neutral-900 print:rounded-none print:border-neutral-500"
              >
                {/* FRONT */}
                <div className="flex h-28 items-center justify-center px-5 py-4 text-center">
                  <p className="font-display text-base font-extrabold leading-snug">
                    {card.front}
                  </p>
                </div>
                {/* Fold line */}
                <div className="border-t-2 border-dashed border-neutral-300 py-0.5 text-center text-[9px] uppercase tracking-widest text-neutral-400 print:border-neutral-500">
                  cut · fold here
                </div>
                {/* BACK — rotated 180° so the folded card reads both sides */}
                <div
                  className={`flex h-28 items-center justify-center px-5 py-4 text-center ${
                    folded ? 'rotate-180' : ''
                  }`}
                >
                  <div>
                    <p className="text-sm leading-snug">{card.back}</p>
                    {(card.source_section || card.source_page != null) && (
                      <p className="mt-1.5 text-[10px] text-neutral-400">
                        {[card.source_section, card.source_page != null ? `p. ${card.source_page}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-muted print:hidden">
            Tip: print single-sided on card stock, cut the strips, fold each in half so the
            back is inside, and tape the edges. Uncheck “Folded orientation” to read the
            backs on screen, but keep it checked when printing.
          </p>
        </>
      )}
    </div>
  )
}
