/**
 * Sourcery background worker (PRD 13.2). Run with: `npm run worker`.
 *
 * A long-lived Node process that owns the pg-boss queue and executes
 * extraction jobs off the request path. The web app only enqueues; this
 * process does the CPU/IO-heavy PDF/DOCX work and writes results back.
 *
 * Env is loaded by Node (--env-file=.env.local in the npm script), so
 * DATABASE_URL + the Supabase keys must be present there.
 */
import { PgBoss } from 'pg-boss'
import { handleExtractDocument } from '../src/lib/jobs/handlers'
import { handleGenerateQuestions } from '../src/lib/jobs/generate'
import { JOBS } from '../src/lib/constants'
import type { ExtractJobPayload, GenerateJobPayload } from '../src/lib/jobs/queue'

if (!process.env.DATABASE_URL) {
  console.error('[worker] DATABASE_URL is not set. Put it in .env.local and rerun `npm run worker`.')
  process.exit(1)
}

const boss = new PgBoss({ connectionString: process.env.DATABASE_URL })

boss.on('error', (err) => console.error('[worker] pg-boss error:', err))
// NOTE: a 'wip' listener was used to diagnose a stuck worker (jobs queue
// empty = nobody listening). It dumps the full queue state every few seconds
// even when idle, so it stays out of the normal log path - start/done/failed
// lines above already tell you what is running.

async function main() {
  await boss.start()
  await boss.createQueue(JOBS.EXTRACT_DOCUMENT, {
    retryLimit: 2,
    retryDelay: 15,
    expireInSeconds: 900,
  })
  await boss.createQueue(JOBS.GENERATE_QUESTIONS, {
    retryLimit: 2,
    retryDelay: 20,
    expireInSeconds: 1800,
  })

  await boss.work(JOBS.EXTRACT_DOCUMENT, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] start ${job.id}`)
      try {
        await handleExtractDocument(job.data as ExtractJobPayload)
        console.log(`[worker] done ${job.id}`)
      } catch (err) {
        console.error(`[worker] failed ${job.id}:`, err)
        throw err // let pg-boss apply its retry policy (PRD 11: 2 retries)
      }
    }
  })

  await boss.work(JOBS.GENERATE_QUESTIONS, async (jobs) => {
    for (const job of jobs) {
      console.log(`[worker] start ${job.id} (generate)`)
      try {
        await handleGenerateQuestions(job.data as GenerateJobPayload)
        console.log(`[worker] done ${job.id}`)
      } catch (err) {
        console.error(`[worker] failed ${job.id}:`, err)
        throw err
      }
    }
  })

  console.log('[worker] listening for extract-document and generate-questions jobs…')
}

main().catch((err) => {
  console.error('[worker] fatal:', err)
  process.exit(1)
})

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig} received, stopping…`)
    boss
      .stop({ graceful: true, timeout: 10 })
      .finally(() => process.exit(0))
  })
}
