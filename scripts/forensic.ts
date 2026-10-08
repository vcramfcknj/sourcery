// One-off forensic check: reviewer row state, FK constraint definitions and
// counts around a given reviewer id.
// Run: node --env-file=.env.local --import tsx scripts/forensic.ts <reviewerId>
import { Client } from 'pg'

async function main() {
  const rid = process.argv[2]
  const db = new Client({ connectionString: process.env.DATABASE_URL! })
  await db.connect()

  const rev = await db.query(
    'select id, status, question_count from reviewers where id = $1',
    [rid],
  )
  console.log('reviewer row:', JSON.stringify(rev.rows))

  const cons = await db.query(
    `select conname, pg_get_constraintdef(oid) as def
       from pg_constraint
      where conrelid in ('public.rejected_questions'::regclass, 'public.questions'::regclass)
        and contype = 'f'`,
  )
  console.log('\nFK constraints:')
  for (const c of cons.rows) console.log(` ${c.conname}: ${c.def}`)

  const counts = await db.query(
    `select
      (select count(*) from questions where reviewer_id = $1)::int as questions,
      (select count(*) from rejected_questions where reviewer_id = $1)::int as rejections,
      (select count(*) from document_chunks c
         join documents d on d.id = c.document_id
        where d.reviewer_id = $1)::int as chunks`,
    [rid],
  )
  console.log('\ncounts:', JSON.stringify(counts.rows[0]))

  // Does every question's source_chunk_id still point at an existing chunk?
  const orphan = await db.query(
    `select q.id, q.source_chunk_id, (select exists(select 1 from document_chunks c where c.id = q.source_chunk_id)) as chunk_exists
       from questions q where q.reviewer_id = $1`,
    [rid],
  )
  console.log('\nquestion chunk refs:')
  for (const o of orphan.rows) console.log(` ${o.id} -> chunk ${o.source_chunk_id} exists=${o.chunk_exists}`)

  await db.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
