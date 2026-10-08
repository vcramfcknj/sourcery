'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { requestPasswordReset } from '@/app/actions/auth'
import { fieldInputCls, fieldLabelCls } from './AuthForm'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand px-4 py-2.5 font-semibold text-white shadow-[0_10px_22px_-12px_rgba(90,97,183,0.8)] transition hover:bg-brand-hover active:translate-y-px disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? 'Working…' : 'Email me a reset link'}
    </button>
  )
}

/**
 * Forgot-password form (PRD 8). On success we show the SAME message for
 * registered and unregistered emails - the response must not leak whether an
 * account exists.
 */
export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(
    async (_prev: { error?: string; sent?: boolean } | null, formData: FormData) =>
      requestPasswordReset(formData),
    null,
  )
  const [email, setEmail] = useState('')

  if (state?.sent) {
    return (
      <div role="status" className="rounded-xl border border-line bg-background px-4 py-3 text-sm">
        If an account exists for <span className="font-medium">{email}</span>, a reset link is on
        its way. It expires soon — check your spam folder if nothing arrives.
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className={fieldLabelCls}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldInputCls}
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  )
}
