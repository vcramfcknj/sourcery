'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

type State = { error?: string }

/**
 * Danger zone (PRD 27.4 account deletion, Phase 6). Two deliberate steps:
 * open the confirmation, then type the exact account email. The action also
 * re-checks the email server-side, so the UI friction is honest, not cosmetic
 * (confirmation-dialogs guidance, ui-ux-pro-max UX-004). Errors surface via
 * role="alert"; the destructive button uses icon + text, never color alone.
 * Same action-prop pattern as AuthForm: the server page binds the inline
 * 'use server' wrapper, this component stays a pure client island.
 */
function DeleteSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-full bg-danger px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Deleting…' : 'Permanently delete account'}
    </button>
  )
}

export function DeleteAccountCard({
  email,
  action,
}: {
  email: string
  action: (state: State, payload: FormData) => Promise<State>
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useActionState(action, {})

  return (
    <section className="rounded-card border border-danger/35 bg-surface p-6 shadow-soft">
      <h2 className="font-display text-lg font-bold text-danger">Delete account</h2>
      <p className="mt-2 text-sm text-muted">
        Permanently removes your account and <strong>all</strong> of your data:
        uploaded files, extracted text, reviewers, questions, attempt history
        and answers. This cannot be undone.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-danger/50 bg-surface px-5 py-2.5 text-sm font-semibold text-danger transition hover:bg-danger/10"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
          Delete my account
        </button>
      ) : (
        <form action={formAction} className="mt-5 rounded-2xl bg-danger/5 p-4">
          <label htmlFor="confirm-email" className="block text-sm font-medium">
            Type your account email to confirm —{' '}
            <span className="font-semibold text-foreground">{email}</span>
          </label>
          <input
            id="confirm-email"
            name="confirm_email"
            type="email"
            required
            autoComplete="off"
            placeholder="you@example.com"
            className="mt-2 w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
          {state.error && (
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {state.error}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <DeleteSubmitButton />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-background"
            >
              Keep my account
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
