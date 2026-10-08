/**
 * Format dispatcher + the end-to-end extraction pipeline used by the worker.
 * Takes raw bytes and a content type, returns chunk drafts, the joined text,
 * the quality report, and detected topics - everything needed to store
 * document_chunks and decide whether to proceed (PRD 13.1, 15.1, 12.2).
 */
import { extractPdf } from './pdf'
import { extractDocx } from './docx'
import { chunkDoc, type ExtractedDoc, type ChunkDraft } from './chunk'
import { scoreTextQuality, type QualityReport } from './text-quality'
import { describeQualityFailure } from './failures'
import type { Document } from '../types'

export interface ProcessedDocument {
  extracted: ExtractedDoc
  fullText: string
  chunks: ChunkDraft[]
  quality: QualityReport
  topics: string[]
  pageCount: number | null
}

export function detectFormat(fileType: string, fileName: string): 'pdf' | 'docx' {
  const t = fileType.toLowerCase()
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (t.includes('pdf') || ext === 'pdf') return 'pdf'
  if (t.includes('word') || ext === 'docx') return 'docx'
  throw new Error(`Unsupported file type: ${fileType || ext}`)
}

/**
 * @param document - the documents row (gives file_name/file_type)
 * @param bytes - the original file bytes downloaded from private storage
 */
export async function processDocumentBytes(
  document: Pick<Document, 'file_name' | 'file_type'>,
  bytes: Uint8Array,
): Promise<ProcessedDocument> {
  const format = detectFormat(document.file_type, document.file_name)
  const extracted = format === 'pdf' ? await extractPdf(bytes) : await extractDocx(bytes)

  const { fullText, chunks } = chunkDoc(extracted)
  const quality = scoreTextQuality(fullText)
  // Fail-fast guard copy (PRD 29.4/35): replace generic reasons with the
  // specific diagnosis — scanned PDF vs empty file vs garbled text — before
  // the worker surfaces it on the failed screen.
  if (!quality.passed) {
    quality.reason = describeQualityFailure(quality, extracted.pageCount, format)
  }

  return {
    extracted,
    fullText,
    chunks,
    quality,
    topics: detectTopics(extracted),
    pageCount: extracted.pageCount,
  }
}

/**
 * Detected topics for the Verify screen (PRD 12.2). MVP derives them from
 * document structure (headings/sections) with zero AI cost. Deduplicated,
 * trimmed, capped to a readable count.
 */
function detectTopics(extracted: ExtractedDoc): string[] {
  const seen = new Set<string>()
  const topics: string[] = []
  const push = (s: string | null | undefined) => {
    if (!s) return
    const clean = s.replace(/\s+/g, ' ').trim()
    if (clean.length < 3 || clean.length > 80) return
    const key = clean.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    topics.push(clean)
  }
  // Explicit headings first (strongest signal), then inherited section titles.
  for (const b of extracted.blocks) if (b.isHeading) push(b.text)
  for (const b of extracted.blocks) if (!b.isHeading) push(b.sectionTitle)
  return topics.slice(0, 12)
}
