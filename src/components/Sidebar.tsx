'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

/**
 * Icon rail (reference dashboard): deep-indigo sidebar, brand mark on top,
 * vertically stacked nav with a periwinkle active tab. Icons are inline SVG
 * (no emoji-as-icon). Each control is keyboard-focusable with an aria-label.
 *
 * Pre-launch polish: the rail EXPANDS to a labeled sidebar while the pointer
 * or keyboard focus is inside it, and collapses back when they leave. Desktop
 * only by construction - the whole aside is hidden below `md`, so touch
 * phones/tablets never see hover behavior at all. Motion respects
 * prefers-reduced-motion via motion-reduce utilities.
 *
 * Layout stability: the OUTER aside is a FIXED-width column (always the
 * expanded 240px), so the page content never shifts horizontally as the rail
 * collapses - the visual rail is the INNER element that animates its width
 * inside that reserved column. This keeps the forms pinned where they are
 * whether the rail is open or collapsed (user request).
 */

type NavItem = {
  href: string
  label: string
  match: (p: string) => boolean
  icon: React.ReactNode
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

const NAV: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    match: (p) => p === '/dashboard' || p === '/',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden {...stroke}>
        <path d="M3 11.5 12 4l9 7.5" />
        <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
      </svg>
    ),
  },
  {
    href: '/reviewers/new',
    label: 'Create reviewer',
    match: (p) => p === '/reviewers/new',
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden {...stroke}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    href: '/flashcards/new',
    label: 'New flashcard deck',
    match: (p) => p === '/flashcards/new' || p.startsWith('/flashcards/'),
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden {...stroke}>
        <rect x="3" y="7.5" width="13" height="12" rx="2.5" />
        <path d="M7 4.5h11a2.5 2.5 0 0 1 2.5 2.5v9" />
        <path d="M6.5 11.5h6.5M6.5 15h4" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    match: (p) => p.startsWith('/settings'),
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.03 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z" />
      </svg>
    ),
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [expanded, setExpanded] = useState(false)

  return (
    // Fixed-width reserved column: its footprint never changes, so the main
    // content stays put when the inner rail collapses.
    <aside
      aria-label="Sidebar"
      className="sticky top-0 hidden h-screen w-60 shrink-0 md:block print:hidden"
    >
      <div
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        onFocus={() => setExpanded(true)}
        onBlur={(e) => {
          // Only collapse when focus actually LEAVES the sidebar (moving
          // between its own links must keep it open).
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setExpanded(false)
        }}
        className={`flex h-full flex-col overflow-hidden bg-gradient-to-b from-sidebar to-sidebar-2 py-6 motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out ${
          expanded ? 'w-60' : 'w-[84px]'
        }`}
      >
      {/* Brand row: badge always; wordmark fades in with the expansion */}
      <div className={`mb-10 flex items-center motion-safe:transition-all motion-safe:duration-300 ${expanded ? 'justify-start px-5' : 'justify-center'}`}>
        <Link
          href="/dashboard"
          aria-label="Sourcery home"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-periwinkle font-display text-xl font-extrabold text-sidebar shadow-clay"
        >
          S
        </Link>
        <span
          aria-hidden={!expanded}
          className={`ml-3 whitespace-nowrap font-display text-lg font-extrabold text-white motion-safe:transition-opacity motion-safe:duration-200 ${
            // `absolute` when collapsed keeps the hidden wordmark OUT of the
            // flex flow - otherwise it widens the row past 84px and the
            // overflow-hidden edge clips the "S" badge off-center.
            expanded ? 'opacity-100' : 'pointer-events-none absolute opacity-0'
          }`}
        >
          Sourcery
        </span>
      </div>

      <nav className={`flex flex-1 flex-col gap-3 motion-safe:transition-all motion-safe:duration-300 ${expanded ? 'px-5' : 'items-center px-0'}`} aria-label="Primary">
        {NAV.map((item) => {
          const active = item.match(pathname)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              title={expanded ? undefined : item.label}
              className={`relative flex shrink-0 items-center rounded-2xl motion-safe:transition-all motion-safe:duration-300 ${
                expanded ? 'h-12 w-full gap-3 px-3' : 'h-12 w-12 justify-center'
              } ${
                active
                  ? 'bg-white/12 text-white'
                  : 'text-white/55 hover:bg-white/8 hover:text-white'
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className={`absolute h-7 w-1.5 rounded-full bg-periwinkle motion-safe:transition-all motion-safe:duration-300 ${
                    expanded ? '-left-2.5' : '-left-3'
                  }`}
                />
              )}
              {item.icon}
              <span
                className={`whitespace-nowrap text-sm font-semibold motion-safe:transition-opacity motion-safe:duration-200 ${
                  expanded ? 'opacity-100' : 'pointer-events-none absolute opacity-0'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
        </nav>
      </div>
    </aside>
  )
}
