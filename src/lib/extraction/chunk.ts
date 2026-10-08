/**
 * Chunking (PRD 13.1 / 14.1). Pure function over an intermediate block model
 * produced by the format-specific extractors. Each emitted chunk carries the
 * format-agnostic source locators the whole product depends on: page (PDF
 * only, nullable), nearest section heading, paragraph index, and the
 * character range within the joined extracted text.
 */
import { CHUNKING } from '../constants'

/** One logical block from the source (a paragraph, list item, heading body). */
export interface ExtractedBlock {
  text: string
  sectionTitle: string | null // nearest heading, null if none seen yet
  pageNumber: number | null // PDF only; DOCX => null
  isHeading?: boolean
}

export interface ExtractedDoc {
  blocks: ExtractedBlock[]
  pageCount: number | null
}

export interface ChunkDraft {
  chunk_index: number
  page_number: number | null
  section_title: string | null
  paragraph_index: number | null
  char_start: number
  char_end: number
  content: string
}

/**
 * Group consecutive blocks into ~TARGET_WORDS windows without splitting a
 * block, so evidence quotes remain verbatim substrings of a single chunk
 * (required by the L1 deterministic validator, PRD 18.1).
 *
 * The joined `fullText` is the exact string the char offsets index into -
 * store it alongside so validation can assert chunk.content is a substring.
 */
export function chunkDoc(doc: ExtractedDoc): {
  fullText: string
  chunks: ChunkDraft[]
} {
  const blocks = doc.blocks.filter((b) => b.text.trim().length > 0)

  // Build the canonical joined text once; offsets reference this string.
  const separators = '\n\n'
  let fullText = ''
  interface Range {
    start: number
    end: number
    paragraph: number
    block: ExtractedBlock
  }
  const blockRanges: Range[] = []
  blocks.forEach((block, i) => {
    const start = fullText.length
    fullText += block.text
    const end = fullText.length
    blockRanges.push({ start, end, paragraph: i, block })
    if (i < blocks.length - 1) fullText += separators
  })

  const chunks: ChunkDraft[] = []
  let current: Range[] = []
  let chunkIndex = 0

  const flush = () => {
    if (current.length === 0) return
    const start = current[0].start
    const end = current[current.length - 1].end
    const content = fullText.slice(start, end)
    if (content.trim().length < CHUNKING.MIN_CHARS) {
      current = []
      return
    }
    // Section title: the most specific heading among the grouped blocks,
    // falling back to the first block's inherited section.
    const heading =
      [...current].reverse().find((r) => r.block.isHeading)?.block.text ??
      current[0].block.sectionTitle
    // Page: PDF page of the first block in the window (null for DOCX).
    const page = current.find((r) => r.block.pageNumber != null)?.block.pageNumber ?? null
    chunks.push({
      chunk_index: chunkIndex++,
      page_number: page,
      section_title: heading,
      paragraph_index: current[0].paragraph,
      char_start: start,
      char_end: end,
      content,
    })
    current = []
  }

  blockRanges.forEach((r) => {
    current.push(r)
    const chars = current.reduce((n, c) => n + (c.end - c.start), 0)
    const words = countWords(current.map((c) => c.block.text).join(' '))
    if (words >= CHUNKING.TARGET_WORDS || chars >= CHUNKING.MAX_CHARS) {
      flush()
    }
  })
  flush()

  return { fullText, chunks }
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length
}
