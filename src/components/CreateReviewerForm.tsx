'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  createReviewerAction,
  issueSignedUploadAction,
  startProcessingAction,
} from '@/app/actions/reviewers'
import {
  DOCUMENTS_BUCKET,
  FLASHCARDS,
  LIMITS,
  QUESTION_COUNT_OPTIONS,
  QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  REVIEWER_MODE_LABELS,
  type QuestionType,
  type Difficulty,
  type ReviewerMode,
} from '@/lib/constants'

/**
 * Create Reviewer (PRD 10.1 / 29.1). One client flow drives three server
 * steps: create rows -> upload the file straight to private storage via a
 * signed URL -> start the background extraction job. We never route the raw
 * bytes through a Server Action (large payload); the browser posts them
 * directly to Supabase Storage.
 *
 * Two deliverables share that one flow (the "flashcards only" mode): the
 * reviewer row records which one it delivers, and the worker stops after
 * extraction + deck building when it is a deck.
 */

const MODES: ReviewerMode[] = ['questions', 'flashcards_only']

const MODE_BLURB: Record<ReviewerMode, string> = {
  questions: 'Grounded questions you can answer and score, plus a printable deck on top.',
  flashcards_only: 'Skip the questions: we read the whole document and build the cut-and-fold deck.',
}

type Phase = 'idle' | 'creating' | 'uploading' | 'starting' | 'error'

const PHASE_LABEL: Record<Phase, string> = {
  idle: '',
  error: '',
  creating: 'Creating your reviewer…',
  uploading: 'Uploading your material…',
  starting: 'Queuing extraction…',
}

// The first step is mode-worded: a deck upload must not read as a reviewer.
const PHASE_LABEL_DECK: Record<Phase, string> = {
  ...PHASE_LABEL,
  creating: 'Creating your deck…',
}

export function CreateReviewerForm({
  defaultMode = 'questions',
  showModePicker = true,
}: {
  defaultMode?: ReviewerMode
  /** False on the dedicated deck entrance, where the mode is already chosen. */
  showModePicker?: boolean
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<ReviewerMode>(defaultMode)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [count, setCount] = useState<number>(10)
  const [types, setTypes] = useState<QuestionType[]>(['multiple_choice'])
  const [difficulty, setDifficulty] = useState<Difficulty>('mixed')

  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)

  const busy = phase === 'creating' || phase === 'uploading' || phase === 'starting'
  const isDeck = mode === 'flashcards_only'

  function pickFile(f: File | null) {
    setFile(f)
    setError(null)
    // Default the reviewer name to the file stem if the user hasn't typed one.
    if (f && !name.trim()) setName(f.name.replace(/\.[^.]+$/, ''))
  }

  function toggleType(t: QuestionType) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  function clientValidate(): string | null {
    if (!name.trim()) return isDeck ? 'Give your deck a name.' : 'Give your reviewer a name.'
    if (!file) return 'Choose a PDF or DOCX file.'
    if (!isDeck && types.length === 0) return 'Select at least one question type.'
    if (file.size > LIMITS.MAX_FILE_SIZE_BYTES)
      return `That file is too large. The maximum is ${LIMITS.MAX_FILE_SIZE_LABEL}.`
    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    if (!LIMITS.ALLOWED_FILE_EXTENSIONS.includes(ext as (typeof LIMITS.ALLOWED_FILE_EXTENSIONS)[number])) {
      // Photos/scans deserve a reason, not a shrug: explain WHY they are out
      // (source-of-truth promise) and what to do instead (PRD 35 guard UX).
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tif', 'tiff', 'heic', 'heif'].includes(ext)) {
        return 'Photos and scanned images (JPG/PNG) are not supported yet — Sourcery grounds every answer in your material’s exact text, and images would break that promise. Export your notes as a text-based PDF or DOCX instead.'
      }
      return 'Only PDF and DOCX files are supported.'
    }
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const invalid = clientValidate()
    if (invalid) {
      setError(invalid)
      return
    }

    setError(null)
    try {
      // 1. Create reviewer + document rows (server re-validates every limit).
      setPhase('creating')
      const created = await createReviewerAction({
        name,
        fileName: file!.name,
        fileType: file!.type,
        fileSize: file!.size,
        requestedCount: isDeck ? 0 : count,
        questionTypes: isDeck ? ['multiple_choice'] : types,
        difficulty: isDeck ? 'mixed' : difficulty,
        mode,
      })
      if (!created.ok) {
        setPhase('error')
        setError(created.error)
        return
      }

      // 2. Get a short-lived signed URL and upload the bytes directly.
      setPhase('uploading')
      const ticket = await issueSignedUploadAction(created.reviewerId)
      if ('error' in ticket) {
        setPhase('error')
        setError(ticket.error)
        return
      }

      const supabase = createClient()
      const { error: uploadErr } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file!, { upsert: true })
      if (uploadErr) {
        setPhase('error')
        setError('The upload failed. Check your connection and try again.')
        return
      }

      // 3. Verify the object landed + enqueue extraction.
      setPhase('starting')
      const started = await startProcessingAction(created.reviewerId)
      if (!started.ok) {
        setPhase('error')
        setError(started.error)
        return
      }

      router.push(`/reviewers/${created.reviewerId}`)
      router.refresh()
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* What should this material become? One flow, two deliverables. */}
      {showModePicker ? (
        <fieldset>
          <legend className="mb-2 text-sm font-medium">What should we build?</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODES.map((m) => (
              <label
                key={m}
                className={`cursor-pointer rounded-xl border px-4 py-3 transition ${
                  mode === m ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:border-brand/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="accent-brand"
                  />
                  <span className="text-sm font-semibold">{REVIEWER_MODE_LABELS[m]}</span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{MODE_BLURB[m]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <p className="rounded-xl border border-line bg-background px-4 py-3 text-sm text-muted">
          Building a <span className="font-semibold text-foreground">flashcard deck</span> —
          up to {FLASHCARDS.MAX_TOTAL} cut-out cards.{' '}
          <Link href="/reviewers/new" className="font-medium text-brand hover:underline">
            Switch to questions
          </Link>
          .
        </p>
      )}

      {/* Name */}
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          {isDeck ? 'Deck name' : 'Reviewer name'}
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          placeholder={isDeck ? 'e.g. Anatomy — Cranial Nerves' : 'e.g. Chapter 4 — Cell Structure'}
          className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-foreground transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
        />
      </div>

      {/* File picker */}
      <div>
        <span className="mb-1 block text-sm font-medium">Study material</span>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-line bg-surface px-4 py-5 text-left transition hover:border-brand"
        >
          <span className={file ? 'text-foreground' : 'text-muted'}>
            {file ? file.name : 'Choose a PDF or DOCX (max 20 MB)'}
          </span>
          <span className="shrink-0 rounded-md border border-line px-3 py-1 text-sm font-medium">
            Browse
          </span>
        </button>
        {/* Upload disclosure + retention policy (PRD 27.4, Phase 6) */}
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Your file is processed by an AI provider only to generate your
          {isDeck ? ' flashcards' : ' questions or flashcards'} — never to train
          models, and it stays visible only to you.
          We keep the file and its extracted text only as long as this
          {isDeck ? ' deck' : ' reviewer'} exists; deleting {isDeck ? 'it' : 'the reviewer'} deletes
          them. You&apos;re responsible for having the right to use what you upload.{' '}
          <Link href="/privacy" className="font-medium text-brand hover:underline">
            Privacy &amp; terms
          </Link>
        </p>
      </div>

      {/* Question settings — they only exist for a question reviewer. */}
      {!isDeck && (
        <>
          {/* Question count */}
          <div>
            <span className="mb-2 block text-sm font-medium">Number of questions</span>
            <div className="flex flex-wrap gap-2">
              {QUESTION_COUNT_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCount(c)}
                  aria-pressed={count === c}
                  className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    count === c
                      ? 'border-brand bg-brand text-white shadow-soft'
                      : 'border-line bg-surface hover:border-brand'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Question types */}
          <div>
            <span className="mb-2 block text-sm font-medium">Question types</span>
            <div className="flex flex-wrap gap-2">
              {QUESTION_TYPES.map((t) => (
                <label
                  key={t}
                  className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                    types.includes(t) ? 'border-brand bg-brand/5' : 'border-line bg-surface'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={types.includes(t)}
                    onChange={() => toggleType(t)}
                    className="accent-brand"
                  />
                  {QUESTION_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div>
            <label htmlFor="difficulty" className="mb-1 block text-sm font-medium">
              Difficulty
            </label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-foreground sm:max-w-xs"
            >
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABELS[d]}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {isDeck && (
        <p className="text-xs leading-relaxed text-muted">
          We spread our reading across the whole document and cap a deck at{' '}
          {FLASHCARDS.MAX_TOTAL} cards, so a long PDF costs the same as a short one.
          Every definition comes from your own text — if a passage can’t support a
          card, we skip it instead of inventing one.
        </p>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white shadow-soft transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? 'Working…' : isDeck ? 'Build my deck' : 'Create & process'}
        </button>
        {busy && (
          <span className="text-sm text-muted">
            {(isDeck ? PHASE_LABEL_DECK : PHASE_LABEL)[phase]}
          </span>
        )}
      </div>
    </form>
  )
}
