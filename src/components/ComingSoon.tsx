import Link from 'next/link'

/**
 * Shared placeholder for screens built in later phases (PRD 36). Keeps the
 * route map of PRD 28.4 navigable instead of 404-ing during Phase 1.
 */
export function ComingSoon({ phase, screen }: { phase: string; screen: string }) {
  return (
    <section className="rounded-card border border-dashed border-line bg-surface px-6 py-16 text-center shadow-soft">
      <h1 className="font-display text-lg font-bold">{screen}</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        This screen is built in {phase}. Phase 1 ships the foundation: auth,
        database with RLS, and the dashboard shell.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-full bg-brand px-5 py-2.5 font-semibold text-white shadow-soft hover:bg-brand-hover"
      >
        Back to Dashboard
      </Link>
    </section>
  )
}
