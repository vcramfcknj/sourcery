import { createBrowserClient } from '@supabase/ssr'

/** Browser-side Supabase client (anon key, RLS-enforced). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Must match the server client: PKCE so any browser-initiated auth (and
    // the code exchange contract the callback route expects) uses ?code=.
    { auth: { flowType: 'pkce' } },
  )
}
