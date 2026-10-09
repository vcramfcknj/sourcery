'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

/**
 * Shown on the "successfully verified" screen after email confirmation. The
 * session is already established by /auth/callback, so we give the user a beat
 * to read the confirmation, then auto-continue into the app. A manual link is
 * provided as a fallback (and for reduced-motion / JS-timing edge cases).
 */
export function VerifiedRedirect({ delaySeconds = 3 }: { delaySeconds?: number }) {
  const router = useRouter()
  const [secs, setSecs] = useState(delaySeconds)

  useEffect(() => {
    if (secs <= 0) {
      router.replace('/dashboard')
      return
    }
    const t = setTimeout(() => setSecs((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secs, router])

  return (
    <div className="flex flex-col items-center gap-3">
      <Link
        href="/dashboard"
        className="inline-block rounded-lg bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-hover"
      >
        Go to dashboard now
      </Link>
      <p className="text-xs text-muted" aria-live="polite">
        Redirecting in {secs}&hellip;
      </p>
    </div>
  )
}
