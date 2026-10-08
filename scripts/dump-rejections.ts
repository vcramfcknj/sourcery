// Dumps the reviewer's requested mix + every logged rejection's key fields,
// to reproduce the selectFinal attrition with real data.
// Run: node --env-file=.env.local --import tsx scripts/dump-rejections.ts <reviewerId>
import { Client } from 'pg'

async function main() {
  const rid = process.argv[2]
  if (!rid) {
    console.error('usage: dump-rejections.ts <reviewerId>')
    process.exit(1)
  }
  const db = new Client({ connectionString: process.env.DATABASE_URL! })
  await db.connect()

  const r = await db.query('select question_types, difficulty, requested_question_count from reviewers where id = $1', [rid])
  console.log('reviewer:', JSON.stringify(r.rows[0]))

  const q = await db.query(
    `select failed_layer, reason,
            candidate->>'type' as type,
            candidate->>'correctAnswer' as answer,
            candidate->>'question' as question,
            jsonb_typeof(candidate->'options') as options_type,
            candidate->'options' as options
       from rejected_questions where reviewer_id = $1 order by created_at`,
    [rid],
  )
  for (const row of q.rows) {
    console.log(
      `\n[${row.failed_layer}] type=${row.type} answer=${JSON.stringify(row.answer)}\n` +
        `  Q: ${String(row.question).slice(0, 120)}\n  options(${row.options_type}): ${String(row.options).slice(0, 160)}\n  reason: ${row.reason}`,
    )
  }

  // How many chunks/sections does this doc have, and what tasks were planned?
  const c = await db.query(
    `select count(*)::int as chunks, count(distinct section_title)::int as sections
       from document_chunks where document_id = (select id from documents where reviewer_id = $1)`,
    [rid],
  )
  console.log('\nchunks:', JSON.stringify(c.rows[0]))

  await db.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
