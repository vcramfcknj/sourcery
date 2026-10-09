import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Email-confirmation / password-recovery / OAuth code exchange (PRD 8.1,
 * verification required).
 *
 * Both outcomes KEEP the session established by exchangeCodeForSession:
 * - Email confirmation (mode=confirm, sent from signup): mark the address
 *   verified, then send the user to /verify-email?verified=1, which shows a
 *   "successfully verified" screen and auto-continues into the app (logged in).
 * - Password recovery / other internal redirects: go to `next` (default
 *   /dashboard), because /reset-password needs that session.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const mode = searchParams.get('mode')
  const next = searchParams.get('next')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (mode === 'confirm') {
        // Verification succeeded and the session is already established here,
        // so keep it: show a success screen that then lands the user in the app.
        return NextResponse.redirect(`${origin}/verify-email?verified=1`)
      }
      // Only allow internal redirects (recovery flow keeps its session).
      const safeNext = next && next.startsWith('/') ? next : '/dashboard'
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=verification`)
}
