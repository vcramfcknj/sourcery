import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

/**
 * Route protection lives in server components/layouts (not middleware):
 * middleware can't mutate request headers for Server Components in this
 * setup, and layouts give the same guarantee without double-fetching.
 * Phase 2 job-polling routes will reuse these helpers.
 */

export async function getUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  return data.user
}

/** Returns the authenticated user or redirects to /login. */
export async function requireUser() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

/** Redirects already-authenticated users away from public auth pages. */
export async function requireAnon() {
  const user = await getUser()
  if (user) redirect('/dashboard')
}
