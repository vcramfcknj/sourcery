import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAnon } from '@/lib/auth'
import { AuthForm } from '@/components/AuthForm'
import { signUp } from '@/app/actions/auth'

export const metadata: Metadata = { title: 'Sign up' }

export default async function SignupPage() {
  await requireAnon()

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Start your first brew</h1>
      <p className="text-sm text-muted mb-6">
        We&apos;ll email you a link to confirm your account. Your material
        stays private to you.
      </p>
      <AuthForm
        action={async (_prev, formData) => {
          'use server'
          return signUp(formData)
        }}
        submitLabel="Create account"
        passwordMode="new"
        showRequirements
        showUsername
      />
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted">
        By creating an account you confirm you have the right to upload the
        material you use. See our{' '}
        <Link href="/privacy" className="font-medium text-brand hover:underline">
          privacy &amp; terms summary
        </Link>
        .
      </p>
    </>
  )
}
