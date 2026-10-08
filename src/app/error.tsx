'use client'

/**
 * Root error boundary (Phase 6 polish). Catches render/runtime errors for
 * every route below it. The message stays generic — never echoing the raw
 * error, which can leak internals (PRD 27.2). `reset` re-renders the segment
 * so a transient failure (e.g. a hiccup reading Supabase) is recoverable
 * without a full reload.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-3xl bg-periwinkle shadow-clay"
      >
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-sidebar" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h1 className="mt-6 font-display text-2xl font-bold text-foreground">
        Something spilled.
      </h1>
      <p className="mt-2 max-w-sm text-sm text-muted">
        An unexpected error occurred while loading this page. Your material and
        progress are safe — try again.
      </p>
      {error.digest && (
        <p className="mt-3 text-xs text-muted">Reference: {error.digest}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="mt-8 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover"
      >
        Try again
      </button>
    </main>
  )
}
