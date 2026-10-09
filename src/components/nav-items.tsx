'use client'

import type { ReactNode } from 'react'

/**
 * Single source of truth for the workspace navigation. Shared by the desktop
 * icon rail (Sidebar) and the mobile off-canvas drawer (MobileNav) so the two
 * can never drift apart. `match` decides the active tab from the pathname.
 */
export type NavItem = {
  href: string
  label: string
  /** Compact label used by the mobile bottom tab bar. */
  tabLabel: string
  match: (p: string) => boolean
  icon: ReactNode
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const NAV: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    tabLabel: 'Home',
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
    tabLabel: 'Create',
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
    tabLabel: 'Decks',
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
    tabLabel: 'Settings',
    match: (p) => p.startsWith('/settings'),
    icon: (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden {...stroke}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.03 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.01a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.03 1.56h.01a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.01a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.03Z" />
      </svg>
    ),
  },
]
