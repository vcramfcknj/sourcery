// Diagnostic: shows the live state of the most recent reviewers, documents,
// generation jobs and pg-boss queue rows so we can see where a run is stuck.
// Run: node --env-file=.env.local --import tsx scripts/diagnose.ts
import { Client } from 'pg'

async function main() {
  // Same connection string the worker uses; TLS settings come from the
  // connection string's own sslmode parameter (no override here).
  const db = new Client({ connectionString: process.env.DATABASE_URL! })
  await db.connect()

  const reviewers = await db.query(
    `select id, name, status, requested_question_count, created_at, updated_at
       from reviewers order by created_at desc limit 5`,
  )
  console.log('=== reviewers (5 most recent) ===')
  for (const r of reviewers.rows) {
    console.log(`${r.id}  "${r.name}"  status=${r.status}  requested=${r.requested_question_count}  created=${r.created_at?.toISOString?.() ?? r.created_at}  updated=${r.updated_at?.toISOString?.() ?? r.updated_at}`)
  }

  const docs = await db.query(
    `select id, reviewer_id, file_name, file_type, page_count, extraction_status, text_quality_score, created_at
       from documents order by created_at desc limit 5`,
  )
  console.log('\n=== documents (5 most recent) ===')
  for (const d of docs.rows) {
    console.log(`${d.id} reviewer=${d.reviewer_id} file="${d.file_name}" extraction=${d.extraction_status} pages=${d.page_count ?? '-'} quality=${d.text_quality_score ?? '-'} created=${d.created_at?.toISOString?.() ?? d.created_at}`)
  }

  const jobs = await db.query(
    `select id, reviewer_id, status, stage, error_code, error_message, attempt_count, started_at, finished_at
       from generation_jobs order by started_at desc nulls first limit 8`,
  )
  console.log('\n=== generation_jobs (8 most recent) ===')
  for (const j of jobs.rows) {
    console.log(
      `${j.id} status=${j.status} stage=${j.stage ?? '-'} attempts=${j.attempt_count ?? '-'} err=${j.error_code ?? '-'} ${j.error_message ?? ''} started=${j.started_at?.toISOString?.() ?? '-'} finished=${j.finished_at?.toISOString?.() ?? '-'}`,
    )
  }

  // pg-boss internal queue state
  try {
    const boss = await db.query(
      `select name, state, count(*)::int as n,
              max(created_on) as latest,
              (select j2.output::text from pgboss.job j2 where j2.name = j1.name and j2.state = 'failed' order by j2.created_on desc limit 1) as last_failure
         from pgboss.job j1 group by name, state order by name, state`,
    )
    console.log('\n=== pgboss.job summary ===')
    for (const b of boss.rows) {
      console.log(`${b.name}  state=${b.state}  count=${b.n}  latest=${b.latest?.toISOString?.() ?? b.latest}`)
      if (b.last_failure) console.log(`   last failure output: ${String(b.last_failure).slice(0, 400)}`)
    }
  } catch (e) {
    console.log('\n(pgboss schema not readable:', (e as Error).message, ')')
  }

  // Why did candidates get rejected? Layer distribution + reasons for the
  // most recent reviewer that has rejections.
  const rejSummary = await db.query(
    `select reviewer_id, failed_layer, count(*)::int as n
       from rejected_questions group by reviewer_id, failed_layer order by max(created_at) desc limit 12`,
  )
  console.log('\n=== rejected_questions by reviewer/layer ===')
  for (const r of rejSummary.rows) {
    console.log(`${r.reviewer_id}  layer=${r.failed_layer}  n=${r.n}`)
  }
  if (rejSummary.rows[0]) {
    const rid = rejSummary.rows[0].reviewer_id as string
    const rejs = await db.query(
      `select failed_layer, reason, candidate->>'question' as q, candidate->>'evidenceQuote' as ev
         from rejected_questions where reviewer_id = $1 order by created_at`,
      [rid],
    )
    console.log(`\n=== rejections for reviewer ${rid} ===`)
    for (const q of rejs.rows) {
      console.log(`[${q.failed_layer}] ${q.reason}\n   Q: ${String(q.q).slice(0, 140)}\n   EV: ${String(q.ev).slice(0, 140)}`)
    }
  }

  await db.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
