'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'
import type { ReviewSession } from '@/lib/data/attempts'
import { saveAnswerAction, finishAttemptAction } from '@/app/actions/attempts'

/**
 * Review experience (PRD 21): one question at a time, free Previous/Next
 * navigation, every answer persisted immediately (21.4), nothing revealed
 * until the attempt is finished (21.2), and an honest confirmation when
 * unanswered questions remain (21.6). The session payload it receives was
 * already stripped of answers server-side and ordered by the attempt's
 * shuffle seed (24.1).
 */

type SaveState = 'saved' | 'saving' | 'error'

export function ReviewScreen({ session }: { session: ReviewSession }) {
  const router = useRouter()
  const [index, setIndex] = useState(session.firstUnansweredIndex)
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    for (const q of session.questions) if (q.savedAnswer !== null) initial[q.id] = q.savedAnswer
    return initial
  })
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>(() => {
    const initial: Record<string, SaveState> = {}
    for (const q of session.questions) if (q.savedAnswer !== null) initial[q.id] = 'saved'
    return initial
  })
  // Questions counted as answered for the progress display. A question is
  // confirmed when the user LEAVES it (Next/Previous/jump) with a selection —
  // choosing an option alone does not tick the counter or fill the dot.
  const [confirmed, setConfirmed] = useState<Record<string, true>>(() => {
    const initial: Record<string, true> = {}
    for (const q of session.questions) if (q.savedAnswer !== null) initial[q.id] = true
    return initial
  })
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)

  // Last requested choice per question, so an in-flight save that was already
  // superseded by a newer click cannot overwrite the newer selection's state.
  const lastRequested = useRef<Record<string, string>>({ ...answers })
  // In-flight answer saves, keyed by question; finish flushes these so a
  // just-selected answer can never be recorded as skipped.
  const pendingSaves = useRef<Record<string, Promise<void>>>({})

  const current = session.questions[index]
  const confirmedCount = Object.keys(confirmed).length
  const selectionCount = Object.keys(answers).length
  const isLast = index === session.questions.length - 1

  const selectOption = useCallback(
    async (questionId: string, option: string) => {
      setAnswers((a) => ({ ...a, [questionId]: option }))
      lastRequested.current[questionId] = option
      setSaveStates((s) => ({ ...s, [questionId]: 'saving' }))
      const save = (async () => {
        try {
          const res = await saveAnswerAction(session.attemptId, questionId, option)
          if (lastRequested.current[questionId] !== option) return // superseded by a newer click
          setSaveStates((s) => ({ ...s, [questionId]: res.ok ? 'saved' : 'error' }))
        } catch {
          if (lastRequested.current[questionId] !== option) return
          setSaveStates((s) => ({ ...s, [questionId]: 'error' }))
        }
      })()
      pendingSaves.current[questionId] = save
      void save.then(() => {
        if (pendingSaves.current[questionId] === save) delete pendingSaves.current[questionId]
      })
    },
    [session.attemptId],
  )

  /** Tick the progress counter for the question being left, if it has a choice. */
  function confirmQuestion(i: number) {
    const q = session.questions[i]
    if (!q || answers[q.id] === undefined) return
    setConfirmed((c) => (c[q.id] ? c : { ...c, [q.id]: true }))
  }

  // --- Identification (typed answer) ----------------------------------------
  // Keep the text in local state as the user types (drives the input value and
  // the answered dot), but only persist on blur / Enter / navigation so we
  // don't fire a save per keystroke. Correctness stays server-side.
  function setText(questionId: string, value: string) {
    setAnswers((a) => {
      const next = { ...a }
      if (value) next[questionId] = value
      else delete next[questionId]
      return next
    })
    if (!value) setConfirmed((c) => { const next = { ...c }; delete next[questionId]; return next })
  }

  function commitText(questionId: string) {
    const value = (answers[questionId] ?? '').trim()
    if (!value) return
    // Skip a redundant save when this exact text is already persisted.
    if (lastRequested.current[questionId] === value && saveStates[questionId] === 'saved') return
    void selectOption(questionId, value)
  }

  function goTo(i: number) {
    if (i === index) return
    const leaving = session.questions[index]
    if (leaving?.type === 'identification') commitText(leaving.id)
    confirmQuestion(index)
    setIndex(Math.max(0, Math.min(session.questions.length - 1, i)))
  }

  async function handleFinish() {
    setFinishing(true)
    setFinishError(null)
    try {
      // Let in-flight saves land before scoring: finish recomputes from the
      // database, so an answer still on the wire would count as skipped.
      await Promise.allSettled(Object.values(pendingSaves.current))
      const res = await finishAttemptAction(session.attemptId)
      if (res.ok) {
        // Scoring is done server-side; hand off to the results route (PRD 22),
        // which re-reads the completed attempt rather than trusting this reply.
        setFinishOpen(false)
        router.push(`/reviewers/${session.reviewerId}/results?attempt=${session.attemptId}`)
      } else {
        setFinishError(res.error)
      }
    } catch {
      setFinishError('Could not finish the review. Please try again.')
    } finally {
      setFinishing(false)
    }
  }

  // The dialog counts questions with no choice at all — a selection that has
  // not been "nexted" yet is still an answer, never a skip.
  function requestFinish() {
    if (selectionCount < session.totalQuestions) setFinishOpen(true)
    else void handleFinish()
  }

  // ---- Finished state -------------------------------------------------------
  // On success handleFinish navigates to /results, so this screen never renders
  // a score itself - the results route owns the post-completion reveal.
  const saveState = saveStates[current.id] ?? 'saved'

  return (
    <main className="mx-auto max-w-2xl pb-16">
      {/* Header: reviewer + real progress (PRD 21.3). The count advances when
          questions are passed via Next, not the instant an option is picked. */}
      <header className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            ← {session.reviewerName}
          </Link>
          <p className="text-sm font-medium text-muted" aria-live="polite">
            Question {index + 1} of {session.totalQuestions}
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={confirmedCount}
          aria-valuemin={0}
          aria-valuemax={session.totalQuestions}
          aria-label="Questions answered"
          className="mt-3 h-2 overflow-hidden rounded-full bg-line/60"
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-300"
            style={{ width: `${(confirmedCount / session.totalQuestions) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted">
          {confirmedCount} of {session.totalQuestions} answered — answers save as you go
        </p>
      </header>

      {/* Question card (PRD 21.1). No correctness feedback anywhere (21.2).
          Keyed by question id, so each advance/rewind replays the fade. */}
      <section
        key={current.id}
        className="anim-fade rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70 sm:p-8"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          {current.heading}
        </p>
        <h1 className="mt-2 font-display text-lg font-bold leading-snug sm:text-xl">
          {current.prompt}
        </h1>

        {current.type === 'identification' ? (
          <div className="mt-6">
            <label htmlFor={`ans-${current.id}`} className="block text-sm font-medium text-muted">
              Type your answer
            </label>
            <input
              id={`ans-${current.id}`}
              type="text"
              value={answers[current.id] ?? ''}
              onChange={(e) => setText(current.id, e.target.value)}
              onBlur={() => commitText(current.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitText(current.id)
                  if (!isLast) goTo(index + 1)
                }
              }}
              maxLength={200}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Your answer"
              className="mt-2 w-full rounded-2xl border border-line bg-background px-4 py-3 text-foreground transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
            />
            <p className="mt-1 text-xs text-muted">
              Capitalization, punctuation and “a/an/the” don’t affect grading.
            </p>
          </div>
        ) : (
          <fieldset className="mt-6">
            <legend className="sr-only">Choose one answer</legend>
            <div className="space-y-3">
              {current.options.map((option, i) => {
                const inputId = `q-${current.id}-o-${i}`
                const checked = answers[current.id] === option
                return (
                  <label
                    key={option}
                    htmlFor={inputId}
                    className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition duration-150 ${
                      checked
                        ? 'border-brand bg-brand/5 ring-1 ring-brand'
                        : 'border-line bg-background hover:border-brand/50'
                    }`}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name={`question-${current.id}`}
                      value={option}
                      checked={checked}
                      onChange={() => void selectOption(current.id, option)}
                      className="h-4 w-4 shrink-0 accent-[var(--color-brand)]"
                    />
                    <span className="font-medium">{option}</span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}

        {/* Persistence status (PRD 21.4): keep the selection, offer retry. */}
        <div className="mt-4 flex min-h-6 items-center gap-2 text-xs" aria-live="polite">
          {saveState === 'saving' && <span className="text-muted">Saving…</span>}
          {saveState === 'saved' && answers[current.id] !== undefined && (
            <span className="text-muted">Saved ✓</span>
          )}
          {saveState === 'error' && (
            <>
              <span className="font-medium text-danger">Couldn’t save your answer.</span>
              <button
                type="button"
                onClick={() => void selectOption(current.id, answers[current.id] ?? '')}
                className="font-semibold text-brand underline"
              >
                Retry
              </button>
            </>
          )}
        </div>
      </section>

      {/* Navigation (PRD 21.3): backward is safe because answers persist. */}
      <nav className="mt-6 flex items-center justify-between gap-3" aria-label="Question navigation">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        {isLast ? (
          <button
            type="button"
            onClick={requestFinish}
            disabled={finishing}
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover disabled:opacity-60"
          >
            {finishing ? 'Finishing…' : 'Finish Review'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover"
          >
            Next
          </button>
        )}
      </nav>

      {/* Answered map: fills when the question is left, never shows correctness. */}
      <ol className="mt-8 flex flex-wrap justify-center gap-2" aria-label="Questions">
        {session.questions.map((q, i) => {
          const answered = confirmed[q.id] === true
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-current={i === index ? 'step' : undefined}
                aria-label={`Question ${i + 1}${answered ? ', answered' : ', not answered'}${i === index ? ', current' : ''}`}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition ${
                  i === index
                    ? 'border-brand ring-2 ring-brand/40'
                    : answered
                      ? 'border-brand/60 bg-brand/10 text-brand'
                      : 'border-line bg-surface text-muted'
                }`}
              >
                {i + 1}
              </button>
            </li>
          )
        })}
      </ol>

      {/* Finish confirmation (PRD 21.6): skipped count as incorrect, honestly stated. */}
      {finishOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center sm:pb-0"
          // Backdrop click cancels the finish confirmation (safe: it only ever
          // dismisses, never finishes). Clicks inside the panel don't match.
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setFinishOpen(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setFinishOpen(false)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="finish-dialog-title"
            className="anim-fade w-full max-w-md rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70"
          >
            <h2 id="finish-dialog-title" className="font-display text-lg font-bold">
              Finish your review?
            </h2>
            <p className="mt-2 text-sm text-muted">
              You still have{' '}
              <strong>
                {session.totalQuestions - selectionCount} unanswered question
                {session.totalQuestions - selectionCount === 1 ? '' : 's'}
              </strong>
              . Unanswered questions count as incorrect and are shown as skipped.
            </p>
            {finishError && <p className="mt-3 text-sm font-medium text-danger">{finishError}</p>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                autoFocus
                onClick={() => setFinishOpen(false)}
                className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-background"
              >
                Return to questions
              </button>
              <button
                type="button"
                onClick={() => void handleFinish()}
                disabled={finishing}
                className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover disabled:opacity-60"
              >
                {finishing ? 'Finishing…' : 'Finish anyway'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
