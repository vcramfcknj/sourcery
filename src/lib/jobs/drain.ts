import 'server-only'
import { getBoss } from './queue'
import { handleExtractDocument } from './handlers'
import { handleGenerateQuestions } from './generate'
import { JOBS } from '../constants'
import type { ExtractJobPayload, GenerateJobPayload } from './queue'

/**
 * Serverless queue drain. This is how Sourcery processes background jobs on
 * Vercel without an always-on worker: every enqueue and every status poll
 * fires `after(() => drainQueue())`, so the SAME function instance keeps
 * executing after the response is sent (Vercel Hobby allows 300s total).
 *
 * One job per queue per call (`batchSize: 1`) keeps the callback bounded and
 * lets the poll loop naturally pick up the next job if any remain. Safe to
 * run alongside the local dev worker (`npm run worker`): pg-boss's `fetch()`
 * atomically transitions a job from 'queued' to 'active', so only one
 * consumer ever processes a given job - no double-run, no lost work.
 *
 * Failure semantics: a handler throw moves the job to 'failed' via pg-boss's
 * `fail()`, which applies the queue's retry policy (PRD 11: 2 automatic
 * retries with delay). If the whole function is killed by Vercel mid-callback
 * (rare: jobs fit well under the 300s cap), pg-boss's `expireInSeconds` timer
 * eventually moves the still-active job back to 'retry', and the next poll
 * drains it. That is the honest durability story.
 */
export async function drainQueue(): Promise<{ extract: number; generate: number }> {
  const boss = await getBoss()
  let extract = 0
  let generate = 0

  const ext = await boss.fetch<ExtractJobPayload>(JOBS.EXTRACT_DOCUMENT, { batchSize: 1 })
  for (const job of ext) {
    try {
      await handleExtractDocument(job.data)
      await boss.complete(JOBS.EXTRACT_DOCUMENT, job.id)
      extract++
    } catch (err) {
      console.error(`[drain] extract ${job.id} failed:`, err)
      await boss.fail(JOBS.EXTRACT_DOCUMENT, job.id, {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  const gen = await boss.fetch<GenerateJobPayload>(JOBS.GENERATE_QUESTIONS, { batchSize: 1 })
  for (const job of gen) {
    try {
      await handleGenerateQuestions(job.data)
      await boss.complete(JOBS.GENERATE_QUESTIONS, job.id)
      generate++
    } catch (err) {
      console.error(`[drain] generate ${job.id} failed:`, err)
      await boss.fail(JOBS.GENERATE_QUESTIONS, job.id, {
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { extract, generate }
}
