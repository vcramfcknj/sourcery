'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { updatePassword } from '@/app/actions/auth'
import { PasswordChecklist, PasswordField } from './AuthForm'

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand px-4 py-2.5 font-semibold text-white shadow-[0_10px_22px_-12px_rgba(90,97,183,0.8)] transition hover:bg-brand-hover active:translate-y-px disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? 'Working…' : 'Save new password'}
    </button>
  )
}

/**
 * Set a new password while the recovery session from the emailed link is
 * active. Same live checklist and show/hide toggle as signup; the action
 * re-validates server-side.
 */
export function ResetPasswordForm() {
  const [state, formAction] = useActionState(
    async (_prev: { error?: string } | null, formData: FormData) => updatePassword(formData),
    null,
  )
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <PasswordField
        id="password"
        name="password"
        label="New password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      >
        <PasswordChecklist password={password} />
      </PasswordField>
      <PasswordField
        id="confirm"
        name="confirm"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
      />
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <SubmitButton />
    </form>
  )
}
