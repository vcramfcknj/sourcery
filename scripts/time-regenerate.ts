// Times a full regeneration: flips the reviewer off `ready` (bypassing the
// idempotency guard on purpose) and runs the real pipeline end to end.
// Run: node --env-file=.env.local --import tsx scripts/time-regenerate.ts <reviewerId>
import { Client } from 'pg'
import { handleGenerateQuestions } from '../src/lib/jobs/generate'

async function main() {
  const rid = process.argv[2]
  if (!rid) {
    console.error('usage: time-regenerate.ts <reviewerId>')
    process.exit(1)
  }
  const db = new Client({ connectionString: process.env.DATABASE_URL! })
  await db.connect()
  const r = await db.query('select user_id from reviewers where id = $1', [rid])
  if (!r.rowCount) {
    console.error('reviewer not found')
    process.exit(1)
  }
  await db.query("update reviewers set status = 'generating' where id = $1", [rid])
  await db.end()

  const t0 = Date.now()
  await handleGenerateQuestions({ reviewerId: rid, userId: r.rows[0].user_id })
  console.log(`TOTAL WALL TIME: ${((Date.now() - t0) / 1000).toFixed(1)}s`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
