/**
 * End-to-end identification generation test.
 *
 * Exercises the REAL pipeline against chunks already stored in the DB:
 *   planCoverage(['identification']) -> generateCandidates (Groq) -> L1 -> selectFinal
 *
 * Run with the react-server condition so `server-only` (imported by the model
 * layer) resolves to its no-op shim:
 *   node --env-file=.env.local --conditions react-server --import tsx scripts/test-identification-e2e.ts
 */
import { createAdminClient } from '../src/lib/supabase/admin'
import { planCoverage } from '../src/lib/pipeline/coverage'
import { generateCandidates } from '../src/lib/pipeline/generate'
import { runL1 } from '../src/lib/pipeline/l1'
import { selectFinal } from '../src/lib/pipeline/selection'
import type { DocumentChunk } from '../src/lib/types'

function ok(cond: boolean, msg: string): void {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!cond) process.exitCode = 1
}

async function main(): Promise<void> {
  const supabase = createAdminClient()

  // Find any document that has chunks.
  const { data: anyChunk, error: chunkErr } = await supabase
    .from('document_chunks')
    .select('document_id')
    .limit(1)
  if (chunkErr || !anyChunk?.length) {
    console.log('NO_CHUNKS  No document with chunks exists — upload a file and generate once first.')
    process.exit(0)
  }
  const documentId = anyChunk[0].document_id

  const { data: chunkRows } = await supabase
    .from('document_chunks')
    .select('id, document_id, chunk_index, page_number, section_title, paragraph_index, char_start, char_end, content, created_at')
    .eq('document_id', documentId)
    .order('chunk_index', { ascending: true })
  const chunks = (chunkRows ?? []) as DocumentChunk[]
  console.log(`Loaded ${chunks.length} chunks from document ${documentId}`)

  const TYPES = ['identification'] as const
  const tasks = planCoverage(chunks, 6, TYPES as unknown as ('identification')[], 'mixed')
  console.log(`Coverage plan: ${tasks.length} task(s), every task types = [${[...new Set(tasks.flatMap((t) => t.types))]}]`)
  ok(tasks.every((t) => t.types.length === 1 && t.types[0] === 'identification'), 'coverage requested identification only')

  const { candidates, usage } = await generateCandidates(tasks)
  console.log(`Model returned ${candidates.length} candidate(s) over ${usage.calls} call(s)`)

  const rawTypes = [...new Set(candidates.map((c) => c.candidate.type))]
  console.log(`Raw candidate types: [${rawTypes.join(', ')}]`)

  // L1 must accept identification and require the answer be grounded.
  const survivors = candidates
    .map((item) => ({ item, l1: runL1(item) }))
    .filter((s) => s.l1.pass)
  console.log(`L1 survivors: ${survivors.length}/${candidates.length}`)

  const { selected } = selectFinal(survivors.map((s) => s.item), 6, TYPES as unknown as ('identification')[], 'mixed')
  console.log(`selectFinal chose: ${selected.length}`)
  console.log('------------------------------------------------------------')
  for (const c of selected) {
    console.log(`[${c.candidate.type}] opts=${c.candidate.options.length} :: ${c.candidate.question}`)
    console.log(`        answer="${c.candidate.correctAnswer}"`)
  }
  console.log('------------------------------------------------------------')

  ok(selected.length > 0, 'selection produced at least one question')
  ok(selected.every((c) => c.candidate.type === 'identification'), 'ALL selected questions are identification')
  ok(selected.every((c) => c.candidate.options.length === 0), 'ALL identification questions have EMPTY options (no choices)')
  ok(selected.every((c) => (c.candidate.correctAnswer ?? '').trim().length > 0), 'ALL identification questions have a non-empty correctAnswer')

  if (process.exitCode) {
    console.log('\nRESULT: FAIL — see assertions above.')
  } else {
    console.log('\nRESULT: ALL PASS — identification generates typed-answer questions with no choices.')
  }
}

main().catch((e) => {
  console.error('ERROR', e)
  process.exit(1)
})
