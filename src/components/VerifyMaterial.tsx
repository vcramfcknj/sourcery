import Link from 'next/link'
import type { VerifyData } from '@/lib/data/reviewers'
import { QUALITY } from '@/lib/constants'
import { GenerateButton } from './GenerateButton'
import { OriginalFileButton } from '@/components/OriginalFileButton'

/**
 * Verify Material (PRD 12). After extraction the user confirms the source is
 * right BEFORE any AI is spent: we show what we detected (sections/topics,
 * chunk count) and an honest text-quality signal. The "no source, no question"
 * principle (PRD 2) means this screen is the last human checkpoint on the
 * material itself.
 */
export function VerifyMaterial({ data }: { data: VerifyData }) {
  const { reviewer, document, chunkCount, topics } = data
  const score = document?.text_quality_score ?? null
  const quality = qualitySignal(score)

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
          ← Back to dashboard
        </Link>
        <h1 className="mt-2 font-display text-2xl font-extrabold">Does this look right?</h1>
        <p className="mt-1 text-sm text-muted">
          We read <span className="font-medium text-foreground">{document?.file_name ?? 'your material'}</span>. Confirm
          what we detected before generating questions.
        </p>
        {/* Verify against the real file, not just our summary of it. */}
        {document && (
          <div className="mt-3">
            <OriginalFileButton reviewerId={reviewer.id} label="View original" />
          </div>
        )}
      </div>

      {/* Quality signal (PRD 15.1) */}
      <div
        className={`rounded-2xl border px-4 py-3 text-sm ${
          quality.tone === 'good'
            ? 'border-line bg-surface text-foreground'
            : 'border-warning/40 bg-warning/10 text-warning'
        }`}
      >
        <span className="font-semibold">{quality.label}. </span>
        {quality.note}
        {document?.page_count != null && (
          <span className="mt-1 block text-muted">Detected {document.page_count} page(s).</span>
        )}
      </div>

      {/* Detected sections / topics */}
      <section className="mt-6 rounded-card bg-surface p-6 shadow-card ring-1 ring-line/70">
        <h2 className="font-display font-bold">Sections we found</h2>
        {topics.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            We couldn&apos;t detect clear section headings, but the text is readable. Questions will
            still be grounded directly in the passages.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {topics.map((t) => (
              <li
                key={t.title}
                className="rounded-full border border-line bg-background px-3 py-1 text-sm"
                title={`${t.count} passage(s)`}
              >
                {t.title}
              </li>
            ))}
          </ul>
        )}
        {/* Settings recap shares this panel: the two reads belong together
            and the extra width stops them floating in dead space. */}
        <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-4 text-sm">
          <div>
            <dt className="text-muted">Name</dt>
            <dd className="mt-0.5 font-medium">{reviewer.name}</dd>
          </div>
          <div>
            <dt className="text-muted">Target questions</dt>
            <dd className="mt-0.5 font-medium">{reviewer.requested_question_count}</dd>
          </div>
          <div>
            <dt className="text-muted">Difficulty</dt>
            <dd className="mt-0.5 font-medium capitalize">{reviewer.difficulty}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-muted">
          {chunkCount} passage{chunkCount === 1 ? '' : 's'} indexed as question sources.
        </p>
      </section>

      {/* Generate CTA - enqueues the Phase 3 background generation job. */}
      <GenerateButton reviewerId={reviewer.id} />
    </div>
  )
}

function qualitySignal(score: number | null): {
  tone: 'good' | 'warn'
  label: string
  note: string
} {
  if (score == null) {
    return { tone: 'warn', label: 'Quality unmeasured', note: 'We could not score the text reliably.' }
  }
  if (score >= 0.6) {
    return {
      tone: 'good',
      label: 'Good quality',
      note: 'We extracted clean, readable text — ready to ground questions.',
    }
  }
  if (score >= QUALITY.MIN_SCORE) {
    return {
      tone: 'warn',
      label: 'Usable but imperfect',
      note: 'Some passages may be messy. We only generate from text we can read, so a few sections might be skipped.',
    }
  }
  return {
    tone: 'warn',
    label: 'Low quality',
    note: 'The extracted text is sparse. Consider re-uploading a clearer PDF or DOCX.',
  }
}
