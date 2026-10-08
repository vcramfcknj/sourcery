'use client'

import { useTransition } from 'react'
import { getOriginalFileAction } from '@/app/actions/files'

/**
 * Opens (or downloads) a reviewer's original uploaded file via a 60-second
 * signed URL. One click, no navigation: PDFs appear in a browser tab, other
 * types download. Errors surface through the optional onError callback so
 * the host screen can show them in its own design language.
 */
export function OriginalFileButton({
  reviewerId,
  variant = 'pill',
  label = 'View original',
  onError,
  onDone,
}: {
  reviewerId: string
  variant?: 'pill' | 'menu' | 'inline'
  label?: string
  onError?: (message: string) => void
  onDone?: () => void
}) {
  const [pending, startTransition] = useTransition()

  function open() {
    startTransition(async () => {
      const res = await getOriginalFileAction(reviewerId)
      if (res.ok && res.url) {
        window.open(res.url, '_blank', 'noopener')
        onDone?.()
      } else {
        onError?.(res.error ?? 'Could not open the original file.')
      }
    })
  }

  if (variant === 'menu') {
    return (
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-background disabled:opacity-60"
      >
        {pending ? 'Preparing…' : label}
      </button>
    )
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={open}
        disabled={pending}
        className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-brand transition hover:bg-brand/5 disabled:opacity-60"
      >
        {pending ? 'Preparing…' : label}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="rounded-full border border-line bg-surface px-6 py-3 font-semibold transition hover:bg-background disabled:opacity-60"
    >
      {pending ? 'Preparing…' : label}
    </button>
  )
}
