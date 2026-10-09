import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server-side Supabase client bound to the request cookies (RLS-enforced,
 * acts as the signed-in user). Use for all reads/writes on behalf of a user.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // PKCE makes email-confirmation / recovery links redirect with ?code=,
      // which the /auth/callback route can exchange server-side. Under the
      // default implicit flow the session lands in the URL #fragment, which a
      // route handler never receives, so confirmation silently failed.
      auth: { flowType: 'pkce' },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component - safe to ignore when middleware
            // refreshes sessions.
          }
        },
      },
    },
  )
}
