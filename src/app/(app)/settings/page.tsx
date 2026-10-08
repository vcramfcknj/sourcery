import type { Metadata } from 'next'
import Link from 'next/link'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { deleteAccountAction } from '@/app/actions/account'
import { getUploadInventory, formatBytes } from '@/lib/data/files'
import { DeleteAccountCard } from '@/components/DeleteAccountCard'
import { OriginalFileButton } from '@/components/OriginalFileButton'

export const metadata: Metadata = { title: 'Settings' }

/**
 * Account settings (Phase 6). Houses the PRD 27.4 obligations in one visible
 * place: what we do with uploaded files, how long we keep them, and the
 * self-service hard delete that removes ALL user data.
 */
export default async function SettingsPage() {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const email = user.email ?? ''
  const uploads = await getUploadInventory()

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold">Settings</h1>
      <p className="mt-1 text-sm text-muted">Your account and your data.</p>

      {/* Account */}
      <section className="mt-8 rounded-card border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold">Account</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="mt-1 font-medium break-all">{email}</dd>
          </div>
          <div>
            <dt className="text-muted">Display name</dt>
            <dd className="mt-1 font-medium">{profile?.display_name ?? '—'}</dd>
          </div>
        </dl>
      </section>

      {/* Your data & privacy (PRD 27.4 disclosure, visible in-app) */}
      <section className="mt-6 rounded-card border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold">Your data &amp; privacy</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted">
          <li>
            Uploaded files are processed by an AI provider solely to generate
            your questions and explanations.
          </li>
          <li>
            We never use your documents to train models, and we never show
            your material to anyone else.
          </li>
          <li>
            Retention: your files and extracted text are kept only as long as
            the reviewer exists — deleting a reviewer deletes them.
          </li>
          <li>
            You are responsible for having the right to upload the material
            you use.
          </li>
        </ul>
        <Link
          href="/privacy"
          className="mt-4 inline-block text-sm font-semibold text-brand hover:underline"
        >
          Read the full privacy &amp; terms summary →
        </Link>
      </section>

      {/* Your uploads: the files capability - retrieve any original you gave
          us. Read-only inventory; files live and die with their reviewer. */}
      <section className="mt-6 rounded-card border border-line bg-surface p-6 shadow-soft">
        <h2 className="font-display text-lg font-bold">Your uploads</h2>
        <p className="mt-1 text-sm text-muted">
          Every original file you&apos;ve given Sourcery. PDFs open in a browser tab;
          other types download. Files are removed together with their reviewer.
        </p>
        {uploads.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Nothing uploaded yet —{' '}
            <Link href="/reviewers/new" className="font-semibold text-brand hover:underline">
              create a reviewer
            </Link>{' '}
            to get started.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {uploads.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={u.fileName}>
                    {u.fileName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatBytes(u.fileSize)} ·{' '}
                    {new Date(u.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    ·{' '}
                    <Link href={`/reviewers/${u.reviewerId}`} className="hover:text-foreground underline underline-offset-2">
                      {u.reviewerName}
                    </Link>
                  </p>
                </div>
                <OriginalFileButton reviewerId={u.reviewerId} variant="inline" label="Get file" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Danger zone (PRD 27.4 account deletion) */}
      <div className="mt-8">
        <DeleteAccountCard
          email={email}
          action={async (_prev, formData) => {
            'use server'
            return deleteAccountAction(formData)
          }}
        />
      </div>
    </div>
  )
}
