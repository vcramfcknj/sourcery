import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { Flashcard } from '@/lib/types'
import type { FlashcardChunk } from '@/lib/pipeline/flashcards'

/**
 * Data access for the printable flashcards trial module. Reads go through the
 * user-scoped client so RLS (flashcards_select / chunks_select) is the
 * ownership gate; writes live in the server action via the admin client.
 */

export async function getFlashcards(reviewerId: string): Promise<Flashcard[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('flashcards')
    .select('*')
    .eq('reviewer_id', reviewerId)
    .order('order_index', { ascending: true })
  if (error) throw new Error(`Failed to load flashcards: ${error.message}`)
  return (data ?? []) as Flashcard[]
}

/**
 * The reviewer's extracted chunks in document order. Empty for a reviewer
 * whose document was never extracted - and because this read is RLS-scoped,
 * an empty result ALSO means "not yours", which is what the server action
 * relies on to refuse cross-user writes.
 */
export async function getReviewerChunks(reviewerId: string): Promise<FlashcardChunk[]> {
  const supabase = await createClient()

  const { data: docs, error: docsErr } = await supabase
    .from('documents')
    .select('id')
    .eq('reviewer_id', reviewerId)
  if (docsErr) throw new Error(`Failed to load documents: ${docsErr.message}`)
  const docIds = (docs ?? []).map((d) => d.id)
  if (docIds.length === 0) return []

  const { data: chunks, error: chunksErr } = await supabase
    .from('document_chunks')
    .select('id, content, section_title, page_number, chunk_index')
    .in('document_id', docIds)
    .order('chunk_index', { ascending: true })
  if (chunksErr) throw new Error(`Failed to load chunks: ${chunksErr.message}`)
  return (chunks ?? []).map((c) => ({
    id: c.id,
    content: c.content,
    section_title: c.section_title ?? null,
    page_number: c.page_number ?? null,
  }))
}
