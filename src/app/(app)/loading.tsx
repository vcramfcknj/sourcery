/**
 * Shared navigation skeleton for the whole workspace segment (Phase 6
 * loading states). The dashboard brings its own richer Suspense skeleton;
 * this covers transitions to reviewer pages, results, answers and settings
 * so navigation never shows a blank flash.
 */
export default function AppLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading page">
      <div className="mb-8 h-7 w-64 rounded-lg bg-line" />
      <div className="mb-10 h-4 w-96 max-w-full rounded-lg bg-line" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-52 rounded-card bg-line" />
        ))}
      </div>
    </div>
  )
}
