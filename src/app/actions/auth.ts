'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { friendlyAuthError, passwordErrorMessage, usernameErrorMessage } from '@/lib/auth/password'

/**
 * Auth server actions (PRD 8). Email verification is required at signup
 * (Open Question #10 decision) - Supabase project settings must have
 * "Confirm email" enabled; signup sends the confirmation mail.
 *
 * Security posture:
 * - Password policy is validated HERE (authoritative), not just in the form
 *   (src/lib/auth/password.ts is the single source of truth).
 * - Reset requests never reveal whether an email is registered.
 * - Raw Supabase errors (rate limits, credential failures) are mapped to
 *   friendly, non-leaky messages.
 */

function normalizeEmail(formData: FormData): string {
  return String(formData.get('email') ?? '').trim().toLowerCase()
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function signUp(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const email = normalizeEmail(formData)
  const password = String(formData.get('password') ?? '')
  const username = String(formData.get('username') ?? '').trim()

  if (!email || !password) return { error: 'Email and password are required.' }
  // Authoritative username check (the trigger stores it as display_name).
  const badName = usernameErrorMessage(username)
  if (badName) return { error: badName }
  const weak = passwordErrorMessage(password)
  if (weak) return { error: weak.charAt(0).toUpperCase() + weak.slice(1) }

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // mode=confirm tells the callback to verify the address, then send the
      // user to /login (with a banner) instead of auto-logging-in this device.
      emailRedirectTo: `${siteUrl()}/auth/callback?mode=confirm`,
      // handle_new_user() mirrors this into profiles.display_name.
      data: { display_name: username },
    },
  })
  if (error) return { error: friendlyAuthError(error.message) }

  // Verification required: send the user to a check-your-inbox screen.
  redirect('/verify-email')
}

export async function signIn(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const email = normalizeEmail(formData)
  const password = String(formData.get('password') ?? '')

  if (!email || !password) return { error: 'Email and password are required.' }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: friendlyAuthError(error.message) }

  redirect('/dashboard')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

/**
 * Forgot password (PRD 8): emails a reset link. The response is IDENTICAL
 * whether or not the address is registered, so this endpoint cannot be used
 * to enumerate accounts. Only genuine rate limiting is surfaced.
 */
export async function requestPasswordReset(
  formData: FormData,
): Promise<{ error?: string; sent?: boolean }> {
  const supabase = await createClient()
  const email = normalizeEmail(formData)
  if (!email || !email.includes('@')) return { error: 'Enter the email for your account.' }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // The callback route exchanges the code for a recovery session and then
    // lands on /reset-password (it only allows internal ?next= paths).
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
  })
  if (error) {
    const friendly = friendlyAuthError(error.message)
    // A rate limit is about THIS browser, not account existence: safe to show.
    if (friendly.startsWith('Too many')) return { error: friendly }
  }
  return { sent: true }
}

/**
 * Complete the reset: requires the recovery session established by the email
 * link (via /auth/callback). Validates the new password with the same policy
 * as signup, then updates it and returns to a logged-in dashboard.
 */
export async function updatePassword(formData: FormData): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  if (!data.user) redirect('/login')

  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password !== confirm) return { error: 'The passwords do not match.' }
  const weak = passwordErrorMessage(password)
  if (weak) return { error: weak.charAt(0).toUpperCase() + weak.slice(1) }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: friendlyAuthError(error.message) }

  redirect('/dashboard')
}
