'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV } from './nav-items'

/**
 * Mobile bottom navigation bar (shown below `md`, where the desktop icon rail
 * is hidden). A floating, clay-styled tab bar - the standard touch pattern -
 * replacing the old hamburger drawer. Active tab gets a periwinkle pill behind
 * its icon; every tab is icon + compact label with a >=44px touch target.
 *
 * Respects the iPhone home-indicator safe area via env(safe-area-inset-bottom),
 * and honors prefers-reduced-motion through motion-safe utilities.
 */
export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden print:hidden"
    >
      <div className="flex w-full max-w-md items-stretch justify-around gap-1 rounded-[26px] border border-line/70 bg-surface/95 p-2 shadow-card backdrop-blur">
        {NAV.map((item) => {
          const active = item.match(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              aria-label={item.label}
              className="group flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl"
            >
              <span
                className={`flex h-8 w-12 items-center justify-center rounded-2xl motion-safe:transition-colors motion-safe:duration-200 ${
                  active
                    ? 'bg-periwinkle text-sidebar shadow-clay'
                    : 'text-muted group-hover:text-foreground'
                }`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[11px] font-semibold leading-none motion-safe:transition-colors ${
                  active ? 'text-foreground' : 'text-muted'
                }`}
              >
                {item.tabLabel}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
