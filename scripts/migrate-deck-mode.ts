/**
 * Applies migration 0004 ("flashcards only" creation mode) to the live
 * database using the same DATABASE_URL the worker connects with. Idempotent SQL.
 * Run: node --env-file=.env.local --import tsx scripts/migrate-deck-mode.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set (check .env.local).')

  const sql = readFileSync(resolve('supabase/migrations/0004_deck_mode.sql'), 'utf8')

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(sql)
    const col = await client.query(
      `select column_name, column_default, is_nullable
         from information_schema.columns
        where table_schema = 'public' and table_name = 'reviewers' and column_name = 'mode'`,
    )
    console.log('reviewers.mode ->', col.rows[0] ?? 'MISSING')
    const cons = await client.query(
      `select conname from pg_constraint
        where conrelid = 'public.reviewers'::regclass
          and conname in ('reviewers_mode_check', 'reviewers_requested_question_count_check')
        order by conname`,
    )
    console.log('constraints ->', cons.rows.map((r) => r.conname).join(', ') || 'NONE')
    console.log('Migration 0004 applied.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
