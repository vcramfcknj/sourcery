'use server'

import {
  createReviewer,
  issueSignedUpload,
  startProcessing,
  startGeneration,
  type CreateReviewerInput,
  type CreateResult,
  type UploadTicket,
} from '@/lib/data/processing'

/**
 * Thin 'use server' wrappers over the Phase 2 orchestration in
 * src/lib/data/processing.ts. All limit enforcement + ownership (RLS) checks
 * live in those functions, not here (PRD 11: client checks are convenience
 * only). These are called directly from the CreateReviewerForm client
 * component as sequential steps of the create -> upload -> process flow.
 */

export async function createReviewerAction(
  input: CreateReviewerInput,
): Promise<CreateResult> {
  return createReviewer(input)
}

export async function issueSignedUploadAction(
  reviewerId: string,
): Promise<UploadTicket | { error: string }> {
  return issueSignedUpload(reviewerId)
}

export async function startProcessingAction(
  reviewerId: string,
): Promise<{ ok: true; jobId: string | null } | { ok: false; error: string }> {
  return startProcessing(reviewerId)
}

/**
 * Phase 3: called by the Generate Questions button on the Verify screen.
 * Enqueues the generate-questions job (the worker does the AI + validation);
 * returns immediately so the client can switch to the polling screen.
 */
export async function generateQuestionsAction(
  reviewerId: string,
): Promise<{ ok: true; jobId: string | null } | { ok: false; error: string }> {
  return startGeneration(reviewerId)
}
