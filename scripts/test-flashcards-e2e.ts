/**
 * End-to-end trial check for the printable flashcards module: pulls REAL
 * chunks for any reviewer that has them, runs the REAL Groq generation, and
 * asserts the deck shape. No DB writes (the server action owns those).
 *
 * Run: node --env-file=.env.local --conditions react-server --import tsx scripts/test-flashcards-e2e.ts
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { generateFlashcards, pickSpreadChunks } from '../src/lib/pipeline/flashcards'
import { FLASHCARDS } from '../src/lib/constants'

async function main() {
  const admin = createAdminClient()

  // Any reviewer with extracted chunks works - find one straight from the
  // chunk table (extraction_status values are not the point of this test).
  const { data: anyChunk } = await admin
    .from('document_chunks')
    .select('document_id')
    .limit(1)
    .single()
  if (!anyChunk) throw new Error('No chunks in the database - create a reviewer first.')
  const doc = { id: anyChunk.document_id, file_name: anyChunk.document_id }

  const { data: docRow } = await admin
    .from('documents')
    .select('file_name')
    .eq('id', doc.id)
    .single()
  if (docRow) doc.file_name = docRow.file_name

  const { data: chunks, error } = await admin
    .from('document_chunks')
    .select('id, content, section_title, page_number')
    .eq('document_id', doc.id)
    .order('chunk_index', { ascending: true })
  if (error) throw new Error(error.message)
  if (!chunks?.length) throw new Error('Document has no chunks.')

  console.log(`Source: ${doc.file_name} (${chunks.length} chunks)`)
  console.log(`Spread picks ${pickSpreadChunks(chunks).length} of ${chunks.length} chunks (cap ${FLASHCARDS.MAX_CHUNKS})`)

  const t0 = Date.now()
  const { cards } = await generateFlashcards(chunks)
  const secs = ((Date.now() - t0) / 1000).toFixed(1)

  let failures = 0
  const check = (label: string, ok: boolean) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
    if (!ok) failures++
  }

  check('deck is not empty', cards.length > 0)
  check(`deck within cap (${FLASHCARDS.MAX_TOTAL})`, cards.length <= FLASHCARDS.MAX_TOTAL)
  check('every front 2-200 chars', cards.every((c) => c.front.length >= 2 && c.front.length <= 200))
  check('every back 10-600 chars', cards.every((c) => c.back.length >= 10 && c.back.length <= 600))
  const fronts = new Set(cards.map((c) => c.front.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()))
  check('no duplicate fronts', fronts.size === cards.length)

  console.log(`\n${cards.length} cards in ${secs}s - sample:`)
  for (const c of cards.slice(0, 8)) {
    const loc = c.sourceSection ?? (c.sourcePage != null ? `p.${c.sourcePage}` : '')
    console.log(`  [${c.front}] -> ${c.back.slice(0, 90)}${c.back.length > 90 ? '…' : ''}${loc ? ` (${loc})` : ''}`)
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`)
    process.exit(1)
  }
  console.log('\nALL PASS')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
