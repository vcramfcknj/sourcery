import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { requireUser } from '@/lib/auth'
import { getReviewerCards } from '@/lib/data/reviewers'
import { IN_PROGRESS_STATUSES } from '@/lib/constants'
import { ReviewerCard } from '@/components/ReviewerCard'
import type { ReviewerCard as ReviewerCardData } from '@/lib/types'

export const metadata: Metadata = { title: 'Dashboard' }

function StatCard({
  icon,
  label,
  value,
  total,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: number
  total?: number
  hint: string
}) {
  return (
    <div className="rounded-card bg-periwinkle px-5 py-4 text-white shadow-clay">
      <div className="flex items-center gap-2 text-sm font-medium text-white/90">
        <span aria-hidden className="opacity-90">{icon}</span>
        {label}
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold">
        {value}
        {total != null && <span className="text-lg font-bold text-white/70">/{total}</span>}
      </p>
      <p className="mt-1 text-xs text-white/75">{hint}</p>
    </div>
  )
}

async function DashboardContent() {
  const user = await requireUser()
  const cards = await getReviewerCards(user.id)

  const ready = cards.filter((c) => c.reviewer.status === 'ready').length
  const working = cards.filter((c) => IN_PROGRESS_STATUSES.includes(c.reviewer.status)).length

  // Categorize by deliverable type (the two creation modes): question
  // reviewers and printable flashcard decks live in separate sections.
  const questionCards = cards.filter((c) => c.reviewer.mode !== 'flashcards_only')
  const deckCards = cards.filter((c) => c.reviewer.mode === 'flashcards_only')

  return (
    <div>
      <div className="mb-8">
        <h2 className="font-display text-xl font-bold">Welcome back to your study material</h2>
        <p className="text-sm text-muted">
          Turn your uploads into questions you can actually trust.
        </p>
      </div>

      {/* Summary stats (reference dashboard motif) */}
      <div className="anim-stagger mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Reviewers"
          value={cards.length}
          hint="All your created reviewers"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5a2 2 0 0 1 2-2h9l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
            </svg>
          }
        />
        <StatCard
          label="Ready"
          value={ready}
          total={cards.length || undefined}
          hint="Ready to study now"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          }
        />
        <StatCard
          label="In progress"
          value={working}
          hint="Processing or awaiting you"
          icon={
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
          }
        />
      </div>

      {cards.length === 0 ? (
        // Empty state (PRD 29.5)
        <section className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center shadow-soft">
          <h3 className="font-display text-lg font-bold">No reviewers yet.</h3>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
            Turn your study materials into an interactive reviewer.
          </p>
          <Link
            href="/reviewers/new"
            className="mt-6 inline-block rounded-full bg-brand px-5 py-2.5 font-semibold text-white shadow-soft transition hover:bg-brand-hover"
          >
            Create Your First Reviewer
          </Link>
        </section>
      ) : (
        <div className="space-y-12">
          <ReviewerGroup
            title="Reviewers"
            cards={questionCards}
            emptyHint="No question reviewers yet — turn a PDF or DOCX into questions you can answer and score."
            createHref="/reviewers/new"
            createLabel="Create Reviewer"
          />
          <ReviewerGroup
            title="Flashcard decks"
            cards={deckCards}
            emptyHint="No decks yet — upload material once and get a printable cut-and-fold deck."
            createHref="/flashcards/new"
            createLabel="New flashcard deck"
          />
        </div>
      )}
    </div>
  )
}

/** One categorized section of the dashboard: a titled grid, or a hint. */
function ReviewerGroup({
  title,
  cards,
  emptyHint,
  createHref,
  createLabel,
}: {
  title: string
  cards: ReviewerCardData[]
  emptyHint: string
  createHref: string
  createLabel: string
}) {
  return (
    <section aria-labelledby={`group-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2
          id={`group-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="font-display text-xl font-bold"
        >
          {title}
          {cards.length > 0 && (
            <span className="ml-2 align-middle text-sm font-semibold text-muted">
              {cards.length}
            </span>
          )}
        </h2>
        {cards.length > 0 && (
          <Link
            href={createHref}
            className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover sm:hidden"
          >
            {createLabel}
          </Link>
        )}
      </div>

      {cards.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-surface/60 px-5 py-6 text-center text-sm text-muted">
          {emptyHint}{' '}
          <Link href={createHref} className="font-semibold text-brand hover:underline">
            {createLabel} →
          </Link>
        </p>
      ) : (
        <ul className="anim-stagger grid list-none grid-cols-1 gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {cards.map((card) => (
            <ReviewerCard key={card.reviewer.id} card={card} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default function DashboardPage() {
  // Per-user cookie/database data must stream behind a Suspense boundary
  // under Next 16 cacheComponents (shell prerenders, data resolves at runtime).
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading dashboard">
      <div className="mb-4 h-6 w-72 rounded-lg bg-line" />
      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-card bg-line" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-52 rounded-card bg-line" />
        ))}
      </div>
    </div>
  )
}
