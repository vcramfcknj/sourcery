import type { Metadata } from 'next'
import Link from 'next/link'
import { Logo } from '@/components/Logo'

export const metadata: Metadata = { title: 'Check your email' }

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div
          aria-hidden
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-2xl"
        >
          ✉️
        </div>
        <h1 className="text-2xl font-bold mb-2">Confirm your email</h1>
        <p className="text-sm text-muted mb-8">
          We sent a verification link to your inbox. Click it to activate your
          account, then log in. No source, no spell — and no studying on an
          unverified email.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-hover"
        >
          Go to login
        </Link>
      </div>
    </main>
  )
}
