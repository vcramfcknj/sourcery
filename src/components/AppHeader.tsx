'use client'

import Link from 'next/link'
import { useState } from 'react'
import { signOut } from '@/app/actions/auth'
import { useDismissOnOutside } from '@/lib/useDismissOnOutside'

/**
 * Top bar (reference dashboard): friendly greeting on the left, quick "New
 * reviewer" action + profile menu on the right. On small screens (no sidebar)
 * a compact brand mark appears so the user can still get home.
 */
export function AppHeader({
  displayName,
  email,
}: {
  displayName: string | null
  email: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useDismissOnOutside<HTMLDivElement>(menuOpen, () => setMenuOpen(false))
  const greeting = (displayName ?? email.split('@')[0]) || 'there'
  const initial = greeting.charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/80 backdrop-blur print:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-5 py-4 sm:px-8">
        {/* Mobile brand (sidebar is hidden below md) */}
        <Link
          href="/dashboard"
          aria-label="Sourcery home"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand font-display text-lg font-extrabold text-white md:hidden"
        >
          S
        </Link>

        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Hello, {greeting}!
        </h1>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <Link
            href="/reviewers/new"
            className="hidden items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-hover sm:inline-flex"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New reviewer
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-periwinkle font-display text-sm font-bold text-sidebar shadow-clay transition hover:brightness-105"
            >
              {initial}
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-60 rounded-2xl border border-line bg-surface p-1.5 shadow-card"
              >
                <p className="truncate px-3 py-2 text-xs text-muted">{email}</p>
                {/* The sidebar is hidden below md, so this menu is the mobile
                    nav: both creation entrances have to be reachable here. */}
                <Link
                  href="/reviewers/new"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-background"
                >
                  Create reviewer
                </Link>
                <Link
                  href="/flashcards/new"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-background"
                >
                  New flashcard deck
                </Link>
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-background"
                >
                  Settings
                </Link>
                <form action={signOut}>
                  <button
                    type="submit"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-danger transition hover:bg-background"
                  >
                    Log out
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
