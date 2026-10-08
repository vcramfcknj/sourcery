import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Privacy & terms' }

/**
 * Privacy & terms summary (PRD 27.4, Phase 6). Plain, complete and honest:
 * what the AI provider sees, the retention rule, the no-training policy,
 * account deletion, and the user's responsibility for upload rights.
 */
export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Link href="/" className="text-sm font-semibold text-brand hover:underline">
          ← Back to Sourcery
        </Link>
        <h1 className="mt-6 font-display text-3xl font-extrabold">
          Privacy &amp; terms, in plain words
        </h1>
        <p className="mt-2 text-sm text-muted">
          The short version: your material is yours. We process it only to make
          your reviewer, and deleting things really deletes them.
        </p>

        <section className="mt-10">
          <h2 className="font-display text-lg font-bold">What we collect</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your account email and display name, the files you upload
            (PDF/DOCX), the text we extract from them, and your reviewers,
            questions, answers and attempt history. Nothing else — no tracking
            pixels, no advertising trackers, no selling of data.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">
            How your files are processed
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Uploaded material is sent to our AI provider strictly to generate
            questions, answers, explanations and evidence quotes from{' '}
            <strong className="text-foreground">your</strong> document. The
            provider processes prompts to return results and does not use API
            content to train its models. Sourcery itself never uses your
            documents to train anything. Only you can see your material:
            row-level security isolates every row and file per account.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Retention &amp; deletion</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your file and its extracted text are kept only as long as the
            reviewer exists — deleting a reviewer removes its storage files,
            chunks, questions, attempts and answers for good. Deleting your
            account (Settings → Delete account) hard-deletes every row and file
            tied to you. These actions are irreversible.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Your responsibility</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You are responsible for having the right to upload the material you
            use — your own notes, licensed course material, or content you&apos;re
            permitted to study from. Don&apos;t upload material you have no right
            to use.
          </p>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-lg font-bold">Questions</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            This summary is part of the Sourcery terms of use. If anything here
            is unclear, resolve it via the app before uploading sensitive
            material.
          </p>
        </section>
      </div>
    </main>
  )
}
