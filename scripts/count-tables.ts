/** Quick row counts across the pipeline tables.
 * Run: node --env-file=.env.local --conditions react-server --import tsx scripts/count-tables.ts */
import { createAdminClient } from '../src/lib/supabase/admin'

async function main() {
  const a = createAdminClient()
  for (const t of ['reviewers', 'documents', 'document_chunks', 'questions', 'flashcards']) {
    const { count, error } = await a.from(t).select('*', { count: 'exact', head: true })
    console.log(t, '=', error ? `ERR ${error.message}` : count)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
