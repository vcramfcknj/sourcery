import { PASSWORD, USERNAME } from '../constants'

/**
 * Password policy, kept as a pure module so both the server actions and the
 * client checklist use ONE source of truth (PRD 11: client checks are
 * convenience only - the action layer always re-validates).
 */

/** Unmet requirements; empty array means the password passes. */
export function passwordIssues(password: string): string[] {
  const issues: string[] = []
  if (password.length < PASSWORD.MIN_LENGTH) issues.push(`at least ${PASSWORD.MIN_LENGTH} characters`)
  if (password.length > PASSWORD.MAX_LENGTH) issues.push(`no more than ${PASSWORD.MAX_LENGTH} characters`)
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) issues.push('both letters and numbers')
  return issues
}

export function passwordErrorMessage(password: string): string | null {
  const issues = passwordIssues(password)
  return issues.length > 0 ? `Password needs ${issues.join(' and ')}.` : null
}

/** Username policy - same single-source-of-truth pattern as the password. */
export function usernameErrorMessage(username: string): string | null {
  const name = username.trim()
  if (name.length < USERNAME.MIN_LENGTH) return `Username needs at least ${USERNAME.MIN_LENGTH} characters.`
  if (name.length > USERNAME.MAX_LENGTH) return `Username must be ${USERNAME.MAX_LENGTH} characters or fewer.`
  if (!USERNAME.PATTERN.test(name)) return 'Username can only use letters, numbers, dots, underscores and hyphens.'
  return null
}

/** Map raw Supabase auth errors to user-safe, friendly messages. */
export function friendlyAuthError(message: string | null | undefined): string {
  const m = (message ?? '').toLowerCase()
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many attempts — please wait a minute and try again.'
  }
  if (m.includes('invalid login credentials')) {
    return 'Invalid email or password. If you just signed up, check your inbox to verify your email first.'
  }
  if (m.includes('already registered') || m.includes('already exists')) {
    return 'That email already has an account. Try logging in or resetting your password.'
  }
  return message ?? 'Something went wrong. Please try again.'
}
