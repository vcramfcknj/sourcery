import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Password-recovery callback (PRD 8, reset flow).
 *
 * The reset link points here with a query-less URL so it exactly matches the
 * Supabase redirect allowlist. We exchange the code for a recovery session,
 * KEEP it (the /reset-password page needs it), and land the user there.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}/reset-password`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=recovery`)
}
