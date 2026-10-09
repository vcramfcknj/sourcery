import 'server-only'
import { PgBoss } from 'pg-boss'
import { JOBS } from '../constants'

/**
 * pg-boss singleton (PRD 13.2). A Postgres-backed queue: durable, retrying,
 * and it reuses the Supabase Postgres we already have.
 *
 * Long-running extraction NEVER runs inside a web request - it runs as a job
 * handled by the worker process (`npm run worker`). The web server only ever
 * *enqueues*. One lazy instance per process.
 */
let bossPromise: Promise<PgBoss> | null = null

export async function getBoss(): Promise<PgBoss> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for the job queue (see .env.local.example)')
  }
  if (!bossPromise) {
    bossPromise = (async () => {
      const boss = new PgBoss({ connectionString: process.env.DATABASE_URL })
      await boss.start()
      await boss.createQueue(JOBS.EXTRACT_DOCUMENT, {
        retryLimit: 2, // PRD 11: 2 automatic retries, then manual
        retryDelay: 15,
        expireInSeconds: 900, // cap per PRD 30 processing-time target
      })
      await boss.createQueue(JOBS.GENERATE_QUESTIONS, {
        retryLimit: 2,
        retryDelay: 20,
        expireInSeconds: 1800, // PRD 30: generation < 3 min for 20 questions
      })
      return boss
    })()
  }
  return bossPromise
}

export interface ExtractJobPayload {
  reviewerId: string
  documentId: string
  userId: string
}

/**
 * Enqueue with a short bounded retry. On Vercel serverless a cold-start or a
 * momentary pooler blip can make a single boss.send() throw, and the caller
 * treats a null jobId as a permanent reviewer 'failed'. A couple of quick
 * retries absorb those transient errors so a healthy submit isn't lost.
 */
async function sendWithRetry(boss: PgBoss, name: string, payload: object): Promise<string> {
  const attempts = 3
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const id = await boss.send(name, payload)
      if (id) return id
      lastErr = new Error(`pg-boss send(${name}) returned no job id`)
    } catch (err) {
      lastErr = err
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 200 * (i + 1)))
  }
  throw lastErr instanceof Error ? lastErr : new Error(`Failed to enqueue ${name}`)
}

/**
 * Enqueue document extraction. Idempotency (PRD 13.2) is enforced by the
 * worker + status guards, not the queue: a document already extracted or
 * already past 'uploaded'/'processing' is a no-op inside the handler, so a
 * double-submit can never duplicate chunks.
 */
export async function enqueueExtraction(payload: ExtractJobPayload): Promise<string | null> {
  const boss = await getBoss()
  return sendWithRetry(boss, JOBS.EXTRACT_DOCUMENT, payload)
}

export interface GenerateJobPayload {
  reviewerId: string
  userId: string
}

/**
 * Enqueue question generation. Idempotency (PRD 13.2) is enforced by the
 * handler's status guards + delete-then-insert writes, so a double-submit or
 * a retry can never duplicate stored questions for a reviewer.
 */
export async function enqueueGeneration(payload: GenerateJobPayload): Promise<string | null> {
  const boss = await getBoss()
  return sendWithRetry(boss, JOBS.GENERATE_QUESTIONS, payload)
}
