'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateQuestionsAction } from '@/app/actions/reviewers'

/**
 * The "Generate questions" CTA on the Verify Material screen (PRD 29.2:
 * Verify's primary action). It enqueues the background generation job and
 * refreshes so the server component flips to the real-stage processing
 * screen. All AI work happens in the worker - this request only enqueues.
 */
export function GenerateButton({ reviewerId }: { reviewerId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setPending(true)
    setError(null)
    const result = await generateQuestionsAction(reviewerId)
    if (result.ok) {
      router.refresh() // -> ProcessingScreen shows generating/validating stages
      return
    }
    setError(result.error)
    setPending(false)
  }

  return (
    <div className="mt-8 flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-full bg-brand px-6 py-3 font-semibold text-white shadow-soft transition hover:bg-brand-hover disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? 'Starting…' : 'Generate questions'}
      </button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <p className="text-xs text-muted">
        Each question is checked against your material by a 4-layer validation pipeline before it
        appears. This runs in the background.
      </p>
    </div>
  )
}
