import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAnon } from '@/lib/auth'
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm'

export const metadata: Metadata = { title: 'Reset password' }

/** Forgot password (PRD 8): requests the emailed reset link. */
export default async function ForgotPasswordPage() {
  await requireAnon()

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Forgot your password?</h1>
      <p className="text-sm text-muted mb-6">
        We&apos;ll email you a secure link to set a new one. The link expires
        quickly for your safety.
      </p>
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
    </>
  )
}
