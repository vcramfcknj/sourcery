import Link from 'next/link'

/**
 * Branded 404 (Phase 6 polish). Replaces Next's default page everywhere
 * notFound() is thrown (reviewer routes, unknown paths). Design-system
 * tokens only; the copy never leaks whether a resource exists for ANOTHER
 * user (PRD 27.1 - RLS makes those invisible, and this page says so plainly).
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <p className="font-display text-7xl font-extrabold text-brand">404</p>
      <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
        Nothing brewed here.
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        This page doesn&apos;t exist — or it belongs to someone else, which
        amounts to the same thing: we never show one person&apos;s material to
        another.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover"
        >
          Go to dashboard
        </Link>
        <Link
          href="/"
          className="rounded-full border border-line bg-surface px-6 py-3 text-sm font-semibold text-foreground shadow-soft transition hover:bg-background"
        >
          Back to home
        </Link>
      </div>
    </main>
  )
}
