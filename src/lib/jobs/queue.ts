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
 * Enqueue document extraction. Idempotency (PRD 13.2) is enforced by the
 * worker + status guards, not the queue: a document already extracted or
 * already past 'uploaded'/'processing' is a no-op inside the handler, so a
 * double-submit can never duplicate chunks.
 */
export async function enqueueExtraction(payload: ExtractJobPayload): Promise<string | null> {
  const boss = await getBoss()
  return boss.send(JOBS.EXTRACT_DOCUMENT, payload)
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
  return boss.send(JOBS.GENERATE_QUESTIONS, payload)
}
