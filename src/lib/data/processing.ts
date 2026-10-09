import 'server-only'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enqueueExtraction, enqueueGeneration } from '@/lib/jobs/queue'
import { drainQueue } from '@/lib/jobs/drain'
import {
  DOCUMENTS_BUCKET,
  LIMITS,
  QUESTION_TYPES,
  DIFFICULTIES,
  REVIEWER_MODES,
  documentStoragePath,
  type QuestionType,
  type Difficulty,
  type ReviewerMode,
} from '@/lib/constants'

/**
 * Phase 2 server orchestration. All limit checks run HERE (server-side), not
 * in the client (PRD 11: "client checks are for convenience only").
 */

export interface CreateReviewerInput {
  name: string
  fileName: string
  fileType: string
  fileSize: number
  requestedCount: number
  questionTypes: QuestionType[]
  difficulty: Difficulty
  /** Deck mode ('flashcards_only') skips question generation entirely. */
  mode: ReviewerMode
}

export type CreateResult =
  | { ok: true; reviewerId: string; documentId: string; uploadPath: string }
  | { ok: false; error: string }

function validate(input: CreateReviewerInput): string | null {
  if (!input.name || input.name.trim().length === 0) return 'Reviewer name is required.'
  if (input.name.trim().length > 200) return 'Reviewer name is too long.'
  if (!REVIEWER_MODES.includes(input.mode)) return 'Invalid creation mode.'
  // Deck mode asks for no questions, so the question settings simply do not
  // apply there (they are stored as defaults and never read back).
  if (input.mode === 'questions') {
    if (!Number.isInteger(input.requestedCount) || input.requestedCount < 1 || input.requestedCount > LIMITS.MAX_QUESTIONS_PER_GENERATION)
      return `Question count must be between 1 and ${LIMITS.MAX_QUESTIONS_PER_GENERATION}.`
    if (input.questionTypes.length === 0) return 'Select at least one question type.'
    if (!input.questionTypes.every((t) => QUESTION_TYPES.includes(t))) return 'Invalid question type.'
    if (!DIFFICULTIES.includes(input.difficulty)) return 'Invalid difficulty.'
  }
  if (input.fileSize <= 0) return 'File appears to be empty.'
  if (input.fileSize > LIMITS.MAX_FILE_SIZE_BYTES)
    return `File is too large. The maximum is ${LIMITS.MAX_FILE_SIZE_LABEL}.`
  const ext = input.fileName.toLowerCase().split('.').pop() ?? ''
  if (!LIMITS.ALLOWED_FILE_EXTENSIONS.includes(ext as (typeof LIMITS.ALLOWED_FILE_EXTENSIONS)[number]))
    return 'Only PDF and DOCX files are supported.'
  return null
}

/** Step 1: create the reviewer + document rows (status 'uploaded'), subject to quotas. */
export async function createReviewer(input: CreateReviewerInput): Promise<CreateResult> {
  const supabase = await createClient()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  const user = userData.user
  if (userError || !user) return { ok: false, error: 'You must be signed in.' }

  const invalid = validate(input)
  if (invalid) return { ok: false, error: invalid }

  // Quota: max active reviewers (PRD 11).
  const { count: activeCount } = await supabase
    .from('reviewers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
  if ((activeCount ?? 0) >= LIMITS.MAX_ACTIVE_REVIEWERS_PER_USER)
    return { ok: false, error: `You have the maximum of ${LIMITS.MAX_ACTIVE_REVIEWERS_PER_USER} reviewers. Delete one to continue.` }

  // Quota: max generations per user per day (PRD 11). Count reviewers created
  // today - decks included, because a deck spends AI just like a reviewer does.
  const since = new Date()
  since.setHours(0, 0, 0, 0)
  const { count: todayCount } = await supabase
    .from('reviewers')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since.toISOString())
  if ((todayCount ?? 0) >= LIMITS.MAX_GENERATIONS_PER_USER_PER_DAY)
    return { ok: false, error: `You've reached the limit of ${LIMITS.MAX_GENERATIONS_PER_USER_PER_DAY} reviewers per day. Try again tomorrow.` }

  const isDeck = input.mode === 'flashcards_only'
  const { data: reviewer, error: rErr } = await supabase
    .from('reviewers')
    .insert({
      user_id: user.id,
      name: input.name.trim(),
      status: 'uploaded',
      mode: input.mode,
      // 0 = "no questions requested" (deck mode). Storing a fake 1 would make
      // the dashboard quietly lie about what this reviewer delivers.
      requested_question_count: isDeck ? 0 : input.requestedCount,
      question_types: isDeck ? ['multiple_choice'] : input.questionTypes,
      difficulty: isDeck ? 'mixed' : input.difficulty,
    })
    .select('id')
    .single()
  if (rErr || !reviewer) return { ok: false, error: 'Could not create reviewer. Please try again.' }

  const storagePath = documentStoragePath(user.id, reviewer.id, input.fileName)

  // documents has a SELECT-only RLS policy (writes are service-role backend
  // operations by design - see 0001_init.sql). reviewer.id is freshly created
  // for this authenticated user, so the insert is correctly scoped.
  const admin = createAdminClient()
  const { data: document, error: dErr } = await admin
    .from('documents')
    .insert({
      reviewer_id: reviewer.id,
      file_name: input.fileName,
      file_type: input.fileType || guessMimeType(input.fileName),
      file_size: input.fileSize,
      storage_path: storagePath,
      extraction_status: 'pending',
    })
    .select('id')
    .single()
  if (dErr || !document) {
    console.error('documents insert failed:', dErr?.message)
    // Roll back the reviewer so no orphan row remains (PRD 26.3: nothing left behind).
    await supabase.from('reviewers').delete().eq('id', reviewer.id)
    return { ok: false, error: 'Could not record the document. Please try again.' }
  }

  return { ok: true, reviewerId: reviewer.id, documentId: document.id, uploadPath: storagePath }
}

export interface UploadTicket {
  signedUrl: string
  token: string
  path: string
}

/** Step 2: issue a short-lived signed upload URL for the private bucket (PRD 27.1). */
export async function issueSignedUpload(reviewerId: string): Promise<UploadTicket | { error: string }> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return { error: 'You must be signed in.' }

  // Ownership check via RLS-scoped read.
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!doc) return { error: 'Document not found for this reviewer.' }

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(doc.storage_path)
  if (error || !data) return { error: 'Could not prepare the upload. Please try again.' }

  return { signedUrl: data.signedUrl, token: data.token, path: data.path }
}

/** Step 3: after the client finishes uploading, verify the object and enqueue extraction. */
export async function startProcessing(reviewerId: string): Promise<{ ok: true; jobId: string | null } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return { ok: false, error: 'You must be signed in.' }

  const { data: reviewer } = await supabase
    .from('reviewers')
    .select('id, status')
    .eq('id', reviewerId)
    .maybeSingle()
  if (!reviewer) return { ok: false, error: 'Reviewer not found.' }
  // Idempotency guard: only start from the 'uploaded' state.
  if (reviewer.status !== 'uploaded') return { ok: true, jobId: null }

  const { data: doc } = await supabase
    .from('documents')
    .select('id, storage_path')
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (!doc) return { ok: false, error: 'No document attached to this reviewer.' }

  // Confirm the file actually landed before spending a job (client-direct upload).
  const admin = createAdminClient()
  const { data: listed } = await admin.storage.from(DOCUMENTS_BUCKET).list(
    folderOf(doc.storage_path),
    { limit: 200 },
  )
  const base = doc.storage_path.split('/').pop()
  const exists = (listed ?? []).some((o) => o.name === base)
  if (!exists) return { ok: false, error: 'Upload did not complete. Please choose the file again.' }

  // Enqueue FIRST, before flipping the reviewer. A thrown pg-boss error here
  // (cold-start connection, pooler blip) must NOT leave a reviewer parked in
  // 'processing': with no job queued, the status API only ever echoes the
  // queued stage and the screen hangs forever with no path out.
  let jobId: string | null
  try {
    jobId = await enqueueExtraction({ reviewerId, documentId: doc.id, userId: user.id })
  } catch (err) {
    console.error('[enqueue:extract] failed:', err)
    jobId = null
  }
  if (!jobId) {
    // Surface a real, actionable failure instead of a silent zombie.
    await supabase.from('reviewers').update({ status: 'failed' }).eq('id', reviewerId)
    return { ok: false, error: 'Could not start processing. Please try again.' }
  }

  // Only now that the job is genuinely queued do we record the job row and
  // advance the reviewer. generation_jobs is service-role-write-only (SELECT-
  // only RLS); reviewer ownership was verified via the RLS-scoped read above.
  const { error: jobErr } = await admin
    .from('generation_jobs')
    .insert({ reviewer_id: reviewerId, status: 'queued', stage: 'queued' })
  if (jobErr) console.error('generation_jobs insert failed:', jobErr)

  const { error: statusErr } = await supabase
    .from('reviewers')
    .update({ status: 'processing' })
    .eq('id', reviewerId)
  if (statusErr) return { ok: false, error: 'Could not start processing. Please try again.' }

  // Serverless worker replacement: kick the queue immediately after the
  // response goes out, so the user does not wait for the next poll. On Vercel
  // this runs inside the SAME 300s function budget; locally it harmlessly
  // races with `npm run worker` (pg-boss fetch is atomic per job).
  after(() => drainQueue().catch((err) => console.error('[after:extract]', err)))
  return { ok: true, jobId }
}

function folderOf(path: string): string {
  const parts = path.split('/')
  return parts.slice(0, parts.length - 1).join('/')
}

/**
 * Phase 3 trigger: start question generation for a verified reviewer.
 * Only allowed from the 'awaiting_verification' state (the user just
 * confirmed the material), and idempotent: a reviewer already generating or
 * ready is a no-op, so a double-click cannot enqueue two generation jobs
 * (PRD 13.2). All AI + validation runs in the worker, never in this request.
 */
export async function startGeneration(
  reviewerId: string,
): Promise<{ ok: true; jobId: string | null } | { ok: false; error: string }> {
  const supabase = await createClient()
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (!user) return { ok: false, error: 'You must be signed in.' }

  // Ownership enforced by RLS on this read.
  const { data: reviewer } = await supabase
    .from('reviewers')
    .select('id, status')
    .eq('id', reviewerId)
    .maybeSingle()
  if (!reviewer) return { ok: false, error: 'Reviewer not found.' }
  // Idempotent for in-flight/finished work, but a 'failed' reviewer (e.g. a
  // transient enqueue error) must be retryable from the checkpoint, otherwise
  // this returns ok:true and the "Generate questions" button silently lies.
  if (reviewer.status !== 'awaiting_verification' && reviewer.status !== 'failed') {
    return { ok: true, jobId: null }
  }

  const admin = createAdminClient()
  // Enqueue before advancing state (same orphan-hang guard as extraction).
  let jobId: string | null
  try {
    jobId = await enqueueGeneration({ reviewerId, userId: user.id })
  } catch (err) {
    console.error('[enqueue:generate] failed:', err)
    jobId = null
  }
  if (!jobId) {
    await supabase.from('reviewers').update({ status: 'failed' }).eq('id', reviewerId)
    return { ok: false, error: 'Could not start generation. Please try again.' }
  }

  // generation_jobs is service-role-write-only (SELECT-only RLS).
  const { error: jobErr } = await admin
    .from('generation_jobs')
    .insert({ reviewer_id: reviewerId, status: 'queued', stage: 'planning' })
  if (jobErr) console.error('generation_jobs insert failed:', jobErr)

  const { error: statusErr } = await supabase
    .from('reviewers')
    .update({ status: 'generating' })
    .eq('id', reviewerId)
  if (statusErr) return { ok: false, error: 'Could not start generation. Please try again.' }

  // Same after()-based drain: start generation immediately, not on the
  // next 2s poll. If this callback is interrupted, the status poll drains
  // the same queue every 2s afterwards.
  after(() => drainQueue().catch((err) => console.error('[after:generate]', err)))
  return { ok: true, jobId }
}

function guessMimeType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return 'application/octet-stream'
}
