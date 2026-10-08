'use client'

import { useState } from 'react'
import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import type { ReactNode } from 'react'
import { PASSWORD, USERNAME } from '@/lib/constants'
import { passwordIssues } from '@/lib/auth/password'

type State = { error?: string } | null

/** Shared claymorphism field styling - one source of truth for all auth inputs. */
export const fieldLabelCls = 'block text-sm font-medium mb-1.5'
export const fieldInputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-foreground ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-brand ' +
  'aria-invalid:border-danger'

function SubmitButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-xl bg-brand px-4 py-2.5 font-semibold text-white shadow-[0_10px_22px_-12px_rgba(90,97,183,0.8)] transition hover:bg-brand-hover active:translate-y-px disabled:opacity-60 disabled:cursor-wait"
    >
      {pending ? 'Working…' : children}
    </button>
  )
}

/** Minimal inline icons (no icon library on the bundle). */
function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      {open ? (
        <>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3.5 8 10 8a9.12 9.12 0 0 0 5.39-1.61" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <path d="m2 2 20 20" />
        </>
      )}
    </svg>
  )
}

/**
 * Password input with an accessible show/hide toggle. The button sits inside
 * the field's right edge; its accessible name flips with the state so screen
 * readers announce what it will do.
 */
export function PasswordField({
  id,
  name,
  label,
  autoComplete,
  value,
  onChange,
  required = true,
  children,
}: {
  id: string
  name: string
  label: string
  autoComplete: 'current-password' | 'new-password'
  value: string
  onChange: (v: string) => void
  required?: boolean
  children?: ReactNode
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={fieldLabelCls}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldInputCls} pr-11`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted transition hover:text-brand"
        >
          <EyeIcon open={visible} />
        </button>
      </div>
      {children}
    </div>
  )
}

/**
 * Live password requirements checklist (client convenience only - the server
 * action re-validates; src/lib/auth/password.ts is the shared source of
 * truth). Turns each unmet rule green as it is satisfied.
 */
export function PasswordChecklist({ password }: { password: string }) {
  const issues = passwordIssues(password)
  const rules = [
    { label: `At least ${PASSWORD.MIN_LENGTH} characters`, met: !issues.some((i) => i.includes('characters)')) && password.length >= PASSWORD.MIN_LENGTH },
    { label: 'Letters and numbers', met: !issues.includes('both letters and numbers') },
  ]
  if (password.length === 0) {
    return (
      <ul className="mt-2 flex flex-col gap-0.5 text-xs text-muted" aria-label="Password requirements">
        {rules.map((r) => (
          <li key={r.label}>· {r.label}</li>
        ))}
      </ul>
    )
  }
  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-xs" aria-label="Password requirements">
      {rules.map((r) => (
        <li key={r.label} className={r.met ? 'text-success' : 'text-muted'}>
          {r.met ? '✓' : '·'} {r.label}
        </li>
      ))}
    </ul>
  )
}

/**
 * Email + password form shared by login and signup (PRD 8). Server action
 * returns { error } - rendered with role=alert so screen readers announce it.
 * showUsername adds the display-name field (stored as profiles.display_name
 * via the signup metadata); passwordMode="new" adds the live checklist.
 */
export function AuthForm({
  action,
  submitLabel,
  children,
  passwordMode = 'current',
  showRequirements = false,
  showUsername = false,
}: {
  action: (prevState: State, payload: FormData) => Promise<State>
  submitLabel: string
  children?: ReactNode
  passwordMode?: 'current' | 'new'
  showRequirements?: boolean
  showUsername?: boolean
}) {
  const [state, formAction] = useActionState(action, null)
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {showUsername && (
        <div>
          <label htmlFor="username" className={fieldLabelCls}>
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            required
            minLength={USERNAME.MIN_LENGTH}
            maxLength={USERNAME.MAX_LENGTH}
            pattern="[A-Za-z0-9._\-]+"
            title={`${USERNAME.MIN_LENGTH}-${USERNAME.MAX_LENGTH} characters; letters, numbers, dots, underscores and hyphens only`}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={fieldInputCls}
          />
          <p className="mt-1.5 text-xs text-muted">
            How reviewers you share with will see you — your display name.
          </p>
        </div>
      )}
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
          className={fieldInputCls}
        />
      </div>
      <PasswordField
        id="password"
        name="password"
        label="Password"
        autoComplete={passwordMode === 'new' ? 'new-password' : 'current-password'}
        value={password}
        onChange={setPassword}
      >
        {showRequirements && <PasswordChecklist password={password} />}
      </PasswordField>
      {children}
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  )
}
