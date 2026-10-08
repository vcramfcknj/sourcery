import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Read-only inventory of the user's uploaded originals (Settings > Your
 * uploads). RLS (documents_select = owns_reviewer) scopes it automatically;
 * there is no user_id filter to forget.
 */

export interface UploadEntry {
  id: string
  reviewerId: string
  reviewerName: string
  fileName: string
  fileType: string
  fileSize: number
  createdAt: string
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function getUploadInventory(): Promise<UploadEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('id, reviewer_id, file_name, file_type, file_size, created_at, reviewers(name)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(`Failed to load uploads: ${error.message}`)
  return (data ?? []).map((d) => ({
    id: d.id,
    reviewerId: d.reviewer_id,
    reviewerName:
      (d.reviewers as { name?: string } | null)?.name ?? 'Unknown reviewer',
    fileName: d.file_name,
    fileType: d.file_type,
    fileSize: d.file_size,
    createdAt: d.created_at,
  }))
}
