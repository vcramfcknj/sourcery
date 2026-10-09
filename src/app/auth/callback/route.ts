import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Email-confirmation callback (PRD 8.1, verification required).
 *
 * Signup sends the user here with a query-less URL so it exactly matches the
 * Supabase redirect allowlist. We exchange the code for a session, KEEP it, and
 * land on /verify-email?verified=1 — a "successfully verified" screen that then
 * auto-continues into the app (logged in). Password recovery has its own
 * /auth/reset route.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Verification succeeded and the session is already established here, so
      // keep it: show the success screen, which then lands the user in the app.
      return NextResponse.redirect(`${origin}/verify-email?verified=1`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=verification`)
}
