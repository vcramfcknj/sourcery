'use server'

import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { DOCUMENTS_BUCKET } from '@/lib/constants'

/**
 * "Get my original back" (files capability, trial-adjacent): mints a
 * SHORT-LIVED (60s) signed URL for the reviewer's uploaded original.
 *
 * Security notes:
 * - The document row is read through the RLS-scoped user client, so a
 *   reviewer id belonging to someone else resolves to nothing here - the
 *   storage path never comes from client input.
 * - The signed URL is opened directly: PDFs render in the browser (with the
 *   viewer's own download control), other types simply download.
 * - 60s TTL keeps a leaked link useless almost immediately; the private
 *   bucket itself is never enumerable by clients (storage RLS).
 */
export async function getOriginalFileAction(
  reviewerId: string,
): Promise<{ ok: boolean; url?: string; fileName?: string; error?: string }> {
  try {
    await requireUser()

    const supabase = await createClient()
    const { data: doc } = await supabase
      .from('documents')
      .select('file_name, storage_path')
      .eq('reviewer_id', reviewerId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!doc) return { ok: false, error: 'No uploaded file found for this reviewer.' }

    const admin = createAdminClient()
    const { data: signed, error } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path, 60)
    if (error || !signed?.signedUrl) {
      return { ok: false, error: 'Could not open the original file. Please try again.' }
    }
    return { ok: true, url: signed.signedUrl, fileName: doc.file_name }
  } catch {
    return { ok: false, error: 'Could not open the original file. Please try again.' }
  }
}
