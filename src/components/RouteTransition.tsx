'use client'

import { usePathname } from 'next/navigation'

/**
 * Replays the `.anim-page` enter animation on every navigation: App Router
 * layouts never remount, but keying this wrapper on the pathname makes React
 * remount its subtree when the route changes, which restarts the CSS
 * animation. The wrapper div is an animation trigger only - it adds no box
 * constraints beyond `min-w-0` so flex siblings keep shrinking correctly.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="anim-page min-w-0">
      {children}
    </div>
  )
}
