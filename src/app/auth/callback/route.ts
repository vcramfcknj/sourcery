import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Email-confirmation / password-recovery / OAuth code exchange (PRD 8.1,
 * verification required).
 *
 * Two deliberately different outcomes:
 * - Email confirmation (mode=confirm, sent from signup): exchange the code to
 *   mark the address verified, then SIGN OUT and send the user to /login with a
 *   success banner. The link is opened in whatever browser checked the email
 *   (frequently a different or shared device from the one that signed up), so
 *   we do NOT silently establish a session there - the user logs in on purpose.
 * - Password recovery / other internal redirects: KEEP the exchanged (recovery)
 *   session and go to `next`, because /reset-password needs that session.
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
        await supabase.auth.signOut() // verification done; don't auto-login this device
        return NextResponse.redirect(`${origin}/login?confirmed=1`)
      }
      // Only allow internal redirects (recovery flow keeps its session).
      const safeNext = next && next.startsWith('/') ? next : '/dashboard'
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=verification`)
}
