/**
 * Applies migration 0003 (printable flashcards - trial) to the live database
 * using the same DATABASE_URL the worker connects with. Idempotent SQL.
 * Run: node --env-file=.env.local --import tsx scripts/migrate-flashcards.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set (check .env.local).')

  const sql = readFileSync(resolve('supabase/migrations/0003_flashcards.sql'), 'utf8')

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(sql)
    const { rows } = await client.query(
      `select exists (
         select 1 from information_schema.tables
          where table_schema = 'public' and table_name = 'flashcards'
       ) as ok`,
    )
    console.log('public.flashcards exists ->', rows[0]?.ok)
    const pol = await client.query(
      `select polname from pg_policy where polrelid = 'public.flashcards'::regclass`,
    )
    console.log('policies ->', pol.rows.map((r) => r.polname).join(', ') || 'NONE')
    console.log('Migration 0003 applied.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
