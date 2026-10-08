import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role client. BYPASSES RLS - server-only, never import from client
 * components or browser code (PRD 27.1/27.2).
 *
 * Intended uses: background job workers (storage deletion on reviewer cascade,
 * system writes on job completion). Ordinary user-scoped reads/writes must go
 * through the cookie-bound client in server.ts so RLS applies.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
