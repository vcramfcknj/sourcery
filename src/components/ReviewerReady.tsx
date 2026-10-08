import Link from 'next/link'
import type { ReadyData } from '@/lib/data/reviewers'
import { OriginalFileButton } from '@/components/OriginalFileButton'

/**
 * Ready screen (PRD 25, 29.2). The reviewer is generated: we show the REAL
 * question count, the coverage across sections, and the type/difficulty mix.
 * When fewer than requested survived validation we say so plainly and offer
 * next steps - we never pad the set with fabricated questions (PRD 3/25).
 * The review experience itself opens in Phase 4.
 */
export function ReviewerReady({ data }: { data: ReadyData }) {
  const { reviewer, questionCount, requested, byType, byDifficulty, topics, attempts } = data
  const short = questionCount < requested

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 font-display text-2xl font-extrabold">{reviewer.name} is ready</h1>
        <p className="mt-1 text-sm text-muted">
          {short
            ? `We could reliably generate ${questionCount} question${questionCount === 1 ? '' : 's'} from this material.`
            : `${questionCount} questions, each grounded in your material with a source you can check.`}
        </p>
      </div>

      {short && (
        <div className="rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
          You asked for {requested}, but only {questionCount} passed our 4-layer source checks. We
          never invent questions to hit a number.{' '}
          <Link href="/reviewers/new" className="font-semibold underline">
            Add more material
          </Link>{' '}
          or continue with these.
        </div>
      )}

      <section className="mt-6 rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70">
        <h2 className="font-display font-bold">What you&apos;ll be tested on</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted">Questions</dt>
            <dd className="font-medium">{questionCount}</dd>
          </div>
          <div>
            <dt className="text-muted">Multiple choice</dt>
            <dd className="font-medium">{byType.multiple_choice}</dd>
          </div>
          <div>
            <dt className="text-muted">True / False</dt>
            <dd className="font-medium">{byType.true_false}</dd>
          </div>
          <div>
            <dt className="text-muted">Identification</dt>
            <dd className="font-medium">{byType.identification}</dd>
          </div>
          <div>
            <dt className="text-muted">Difficulty</dt>
            <dd className="font-medium capitalize">{reviewer.difficulty}</dd>
          </div>
        </dl>
        {topics.length > 0 && (
          <>
            <p className="mt-4 text-xs text-muted">Coverage across your material:</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {topics.map((t) => (
                <li
                  key={t.title}
                  className="rounded-full border border-line bg-background px-3 py-1 text-sm"
                  title={`${t.count} question(s)`}
                >
                  {t.title} <span className="text-muted">({t.count})</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {(byDifficulty.easy > 0 || byDifficulty.medium > 0 || byDifficulty.hard > 0) && (
          <p className="mt-4 text-xs text-muted">
            Mix — Easy {byDifficulty.easy} · Medium {byDifficulty.medium} · Hard {byDifficulty.hard}
          </p>
        )}
      </section>

      {/* Primary CTA (PRD 29.2): Start Review. The route creates a new attempt
      or resumes the in-progress one (PRD 9.1/21.5). */}
      <div className="mt-8 flex flex-col items-start gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/reviewers/${reviewer.id}/review`}
            className="rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-soft transition hover:bg-brand-hover"
          >
            {attempts.length > 0 ? 'Retake review' : 'Start review'}
          </Link>
          {/* Trial module: printable cut-out flashcards from the same material. */}
          <Link
            href={`/reviewers/${reviewer.id}/flashcards`}
            className="rounded-full border border-line bg-surface px-6 py-3 font-semibold transition hover:bg-background"
          >
            Printable flashcards
            <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">
              trial
            </span>
          </Link>
          {/* Your material stays yours: open or download the original. */}
          <OriginalFileButton reviewerId={reviewer.id} label="View original" />
        </div>
        <p className="text-xs text-muted">
          Answers save as you go — you can leave and come back anytime.
        </p>
      </div>

      {/* Attempt history (PRD 24.2): every completed attempt stays viewable. */}
      {attempts.length > 0 && (
        <section className="mt-10 rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70">
          <h2 className="font-display font-bold">Your attempts</h2>
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {[...attempts].reverse().map((a) => (
              <li key={a.attemptId} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Attempt {a.number} ·{' '}
                    <span className="text-muted">
                      {a.completedAt
                        ? new Date(a.completedAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {a.score}/{a.total} correct ({a.percentage}%)
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <Link
                    href={`/reviewers/${reviewer.id}/results?attempt=${a.attemptId}`}
                    className="font-medium text-brand hover:underline"
                  >
                    Results
                  </Link>
                  <Link
                    href={`/reviewers/${reviewer.id}/answers?attempt=${a.attemptId}`}
                    className="font-medium text-brand hover:underline"
                  >
                    Answers
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
