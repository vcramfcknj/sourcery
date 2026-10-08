import type { Metadata } from 'next'
import { requireUser } from '@/lib/auth'
import { ResetPasswordForm } from '@/components/ResetPasswordForm'

export const metadata: Metadata = { title: 'Choose a new password', robots: 'noindex' }

/**
 * Reached ONLY through the emailed reset link: /auth/callback exchanges the
 * code for a recovery session, then lands here. Without that session
 * requireUser bounces to /login, so the page is never an open password form.
 */
export default async function ResetPasswordPage() {
  await requireUser()

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Choose a new password</h1>
      <p className="text-sm text-muted mb-6">
        You&apos;re verified through your reset link — pick a strong password
        below.
      </p>
      <ResetPasswordForm />
    </>
  )
}
