import Link from 'next/link'

/** Wordmark + cauldron-dot mark. Playful name, credible product (PRD 5). */
export function Logo({ href = '/', tone = 'dark' }: { href?: string; tone?: 'dark' | 'light' }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 font-semibold text-lg no-underline ${
        tone === 'light' ? 'text-white' : 'text-foreground'
      }`}
      aria-label="Sourcery home"
    >
      <span
        aria-hidden
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white text-sm font-bold"
      >
        S
      </span>
      Sourcery
    </Link>
  )
}
