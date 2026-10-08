import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAnon } from '@/lib/auth'
import { AuthForm } from '@/components/AuthForm'
import { signIn } from '@/app/actions/auth'

export const metadata: Metadata = { title: 'Log in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirmed?: string; error?: string }>
}) {
  await requireAnon()
  const sp = await searchParams

  return (
    <>
      <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
      <p className="text-sm text-muted mb-6">
        Pick up where your notes left off.
      </p>
      {sp.confirmed && (
        <div
          role="status"
          className="mb-4 rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          Email confirmed — you can log in now.
        </div>
      )}
      {sp.error === 'verification' && (
        <div
          role="alert"
          className="mb-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          That confirmation link is invalid or has expired. Request a new one
          via{' '}
          <Link href="/forgot-password" className="font-semibold underline">
            Forgot password?
          </Link>
          .
        </div>
      )}
      <AuthForm
        action={async (_prev, formData) => {
          'use server'
          return signIn(formData)
        }}
        submitLabel="Log in"
      />
      <p className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-sm text-brand hover:underline">
          Forgot password?
        </Link>
      </p>
      <p className="mt-6 text-center text-sm text-muted">
        No account yet?{' '}
        <Link href="/signup" className="font-medium text-brand hover:underline">
          Sign up
        </Link>
      </p>
    </>
  )
}
