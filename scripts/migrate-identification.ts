/**
 * Applies migration 0002 (identification question type) to the live database
 * using the same DATABASE_URL the worker connects with. Idempotent - the SQL
 * drops the constraint if it exists before recreating it.
 * Run: node --env-file=.env.local --import tsx scripts/migrate-identification.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set (check .env.local).')

  const file = resolve('supabase/migrations/0002_identification_type.sql')
  const sql = readFileSync(file, 'utf8')

  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query(sql)
    const { rows } = await client.query(
      `select pg_get_constraintdef(oid) as def
         from pg_constraint
        where conrelid = 'public.questions'::regclass
          and conname = 'questions_type_check'`,
    )
    console.log('questions_type_check ->', rows[0]?.def ?? 'NOT FOUND')
    console.log('Migration 0002 applied.')
  } finally {
    await client.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
