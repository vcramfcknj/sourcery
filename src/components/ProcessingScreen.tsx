'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { TIME_ESTIMATE, type ExtractionStage, type ReviewerMode } from '@/lib/constants'
import { extractionStepsFor, generationStepsFor, stageLabel } from '@/lib/pipeline/flow'
import { OriginalFileButton } from '@/components/OriginalFileButton'
import {
  generationEstimate,
  deckEstimate,
  extractionEstimate,
  formatDuration,
  formatElapsed,
} from '@/lib/pipeline/estimate'

const GENERATION_STATUSES = new Set(['generating', 'validating', 'ready'])

interface StatusView {
  status: string
  stage: string | null
  errorCode: string | null
  errorMessage: string | null
  startedAt: string | null
  requestedQuestionCount: number
  mode?: ReviewerMode
}

/**
 * Processing screen (PRD 29.3). Polls the reviewer status API and shows the
 * REAL stage the worker wrote to generation_jobs.stage - never a fabricated
 * percentage. Alongside the stages it shows an honest time line: a measured
 * "usually about X" estimate for this phase plus real elapsed time anchored
 * on the job's actual started_at. When elapsed blows past the estimate we say
 * so plainly - in practice that means the worker isn't running (the one
 * failure mode we have measured) - instead of pretending to still be working.
 * The step list and the wording follow the reviewer's MODE (src/lib/pipeline
 * /flow.ts): a deck must never be shown "Creating questions".
 * When the worker flips the reviewer to 'awaiting_verification' or 'ready' we
 * refresh so the server component switches screens. Failures render an
 * actionable message (PRD 29.4).
 */
export function ProcessingScreen({ reviewerId }: { reviewerId: string }) {
  const router = useRouter()
  const [view, setView] = useState<StatusView | null>(null)
  const [failed, setFailed] = useState<StatusView | null>(null)
  const [elapsed, setElapsed] = useState(0)

  // Elapsed-time anchor: the phase whose clock we are measuring, and the epoch
  // ms its job really started (server value) or was first observed (queued).
  const phaseRef = useRef<'ext' | 'gen'>('ext')
  const anchorRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function tick() {
      try {
        const res = await fetch(`/api/reviewers/${reviewerId}/status`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = (await res.json()) as StatusView
        if (cancelled) return

        // Re-anchor when the flow moves from extraction to generation: each
        // job has its own started_at; a reload must not restart the clock.
        const phase = isGenerationPhase(data) ? 'gen' : 'ext'
        if (phase !== phaseRef.current) {
          phaseRef.current = phase
          anchorRef.current = null
        }
        if (data.startedAt) anchorRef.current = Date.parse(data.startedAt)
        else if (anchorRef.current === null) anchorRef.current = Date.now()

        setView(data)

        if (data.status === 'failed') {
          setFailed(data)
          return
        }
        if (data.status === 'awaiting_verification' || data.status === 'ready') {
          router.refresh() // hand off to the Verify/Ready screen on the server
          return
        }
        timer = setTimeout(tick, 2000)
      } catch {
        if (!cancelled) timer = setTimeout(tick, 3000) // transient network blip
      }
    }

    tick()
    const ticker = setInterval(() => {
      if (anchorRef.current === null) return
      const secs = Math.floor((Date.now() - anchorRef.current) / 1000)
      // Clamp nonsense: clock skew (negative) or a long-dead stuck phase.
      setElapsed(Math.min(6 * 3600, Math.max(0, secs)))
    }, 1000)
    return () => {
      cancelled = true
      clearTimeout(timer)
      clearInterval(ticker)
    }
  }, [reviewerId, router])

  if (failed) {
    return (
      <div className="mx-auto max-w-xl rounded-card bg-surface p-8 text-center shadow-card ring-1 ring-line/70">
        <h1 className="font-display text-lg font-bold text-danger">Something went wrong</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          {failed.errorMessage ??
            'We could not process your material. You can try uploading it again.'}
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() =>
              router.push(failed.mode === 'flashcards_only' ? '/flashcards/new' : '/reviewers/new')
            }
            className="rounded-full bg-brand px-5 py-2.5 font-semibold text-white shadow-soft transition hover:bg-brand-hover"
          >
            Try again
          </button>
          {/* The upload still exists - let the user retrieve it before retrying. */}
          <OriginalFileButton reviewerId={reviewerId} label="Download original" />
        </div>
      </div>
    )
  }

  // Show generation steps once the reviewer is in the generate/validate phase,
  // extraction steps before that. Progress reflects real backend stages only.
  const mode: ReviewerMode = view?.mode ?? 'questions'
  const isDeck = mode === 'flashcards_only'
  const isGeneration = isGenerationPhase(view)
  const STEPS: ExtractionStage[] = isGeneration ? generationStepsFor(mode) : extractionStepsFor(mode)
  const activeStage = pickStage(view, STEPS, mode)
  const activeIndex = STEPS.indexOf(activeStage)

  const est = isGeneration
    ? isDeck
      ? deckEstimate()
      : generationEstimate(view?.requestedQuestionCount ?? 10)
    : extractionEstimate()
  // Overrun: real elapsed blew past the measured upper bound. A job stuck in
  // 'queued' past its own warning window is the classic no-worker symptom.
  const overrun =
    view !== null &&
    (elapsed > est.maxSec ||
      (activeStage === 'queued' && elapsed > TIME_ESTIMATE.QUEUED_WARN_SECONDS))

  return (
    <div className="mx-auto max-w-xl rounded-card bg-surface p-8 shadow-card ring-1 ring-line/70">
      <h1 className="font-display text-lg font-bold">
        {isDeck
          ? isGeneration
            ? 'Building your flashcard deck'
            : 'Reading your material'
          : isGeneration
            ? 'Building your reviewer'
            : 'Preparing your reviewer'}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {stageLabel(activeStage, mode)}
        {view
          ? isGeneration
            ? isDeck
              ? ` · usually about ${formatDuration(est.typicalSec)}`
              : ` · usually about ${formatDuration(est.typicalSec)} for ${view.requestedQuestionCount} questions`
            : ' · usually just a few seconds'
          : ' — this can take a moment for larger files.'}
      </p>
      {view && elapsed >= 5 && (
        <p className="mt-0.5 text-xs text-muted" aria-live="polite">
          {formatElapsed(elapsed)} elapsed
        </p>
      )}

      <ol className="mt-6 flex flex-col gap-3">
        {STEPS.map((stage, i) => {
          const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'todo'
          return (
            <li key={stage} className="flex items-center gap-3 text-sm">
              <span
                aria-hidden
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${
                  state === 'done'
                    ? 'border-brand bg-brand text-white'
                    : state === 'active'
                      ? 'border-brand text-brand'
                      : 'border-line text-muted'
                }`}
              >
                {state === 'done' ? '✓' : state === 'active' ? <Spinner /> : ''}
              </span>
              <span
                className={
                  state === 'todo' ? 'text-muted' : 'font-medium text-foreground'
                }
              >
                {stageLabel(stage, mode)}
              </span>
            </li>
          )
        })}
      </ol>

      {/* Honest overrun notice: we never fake progress, so we say what this
          usually means and how to fix it. */}
      {overrun && (
        <p
          role="status"
          className="mt-6 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
        >
          Taking longer than usual. If it&apos;s still going in a minute or two, the background
          worker most likely isn&apos;t running — start everything with{' '}
          <code className="rounded bg-background px-1.5 py-0.5 text-xs">npm run dev:all</code> and
          look for the <span className="font-medium">&ldquo;[worker] listening&hellip;&rdquo;</span>{' '}
          line.
        </p>
      )}
    </div>
  )
}

function isGenerationPhase(view: StatusView | null): boolean {
  if (!view) return false
  if (GENERATION_STATUSES.has(view.status)) return true
  return view.stage === 'planning' || view.stage === 'generating' || view.stage === 'validating' || view.stage === 'selecting'
}

function pickStage(
  view: StatusView | null,
  steps: ExtractionStage[],
  mode: ReviewerMode,
): ExtractionStage {
  const candidate = view?.stage ?? view?.status ?? 'queued'
  if (steps.includes(candidate as ExtractionStage)) return candidate as ExtractionStage
  // Generation phase without a matching stage yet: land on this mode's first
  // real build step (a deck has no planning/validation steps to show).
  if (steps.includes('planning') || steps.includes('generating')) {
    return mode === 'flashcards_only' ? 'generating' : 'planning'
  }
  switch (view?.status) {
    case 'processing':
      return 'downloading'
    case 'extracting':
      return 'extracting'
    case 'structuring':
      return 'structuring'
    case 'awaiting_verification':
      return 'awaiting_verification'
    default:
      return 'queued'
  }
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-brand border-t-transparent"
      aria-hidden
    />
  )
}
