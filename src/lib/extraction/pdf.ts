/**
 * PDF extraction via unpdf (server/worker only - never import from a client
 * component). unpdf wraps a serverless-friendly build of pdf.js.
 *
 * Produces the intermediate ExtractedDoc model. Page numbers ARE available for
 * PDFs (PRD 14.1), so locators are the richer page form. Repeated
 * header/footer lines across pages are stripped (PRD 14.3).
 */
import { extractText, getDocumentProxy } from 'unpdf'
import type { ExtractedBlock, ExtractedDoc } from './chunk'

export async function extractPdf(bytes: Uint8Array): Promise<ExtractedDoc> {
  const pdf = await getDocumentProxy(bytes)
  const { totalPages, text: pages } = await extractText(pdf, { mergePages: false })

  const pageTexts: string[] = Array.isArray(pages) ? pages : [String(pages)]
  const footerLines = detectRepeatedLines(pageTexts)

  const blocks: ExtractedBlock[] = []
  pageTexts.forEach((pageText, i) => {
    const pageNumber = i + 1
    const cleaned = pageText
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0 && !footerLines.has(l.trim()))
      .join('\n')

    // Split into paragraph blocks on blank lines; fall back to single newlines
    // when a page has no blank-line separation.
    const paragraphs = cleaned
      .split(/\n{2,}/)
      .flatMap((para) => (para.includes('\n•') || para.includes('\n-') ? para.split(/\n(?=[•\-\d]\s)/) : [para]))

    for (const para of paragraphs) {
      const text = para.replace(/\s+/g, ' ').trim()
      if (text.length < 2) continue
      const isHeading = looksLikeHeading(text)
      blocks.push({ text, pageNumber, sectionTitle: null, isHeading })
    }
  })

  assignSections(blocks)
  return { blocks, pageCount: totalPages }
}

// A heading heuristic for PDFs (no reliable style info): short line, few
// punctuation marks, not a sentence. Conservative - only marks obvious titles.
function looksLikeHeading(line: string): boolean {
  if (line.length > 80 || line.length < 2) return false
  const words = line.split(/\s+/)
  if (words.length > 10) return false
  const hasSentencePunct = /[.!?,;]$/.test(line)
  return !hasSentencePunct
}

/** Detect lines appearing on >=60% of pages with content (headers/footers). */
function detectRepeatedLines(pageTexts: string[]): Set<string> {
  const counts = new Map<string, number>()
  const pagesWithData = pageTexts.filter((p) => p.trim().length > 0).length
  for (const page of pageTexts) {
    const seen = new Set<string>()
    for (const line of page.split(/\r?\n/)) {
      const t = line.trim()
      if (t.length === 0 || t.length > 60) continue
      if (seen.has(t)) continue
      seen.add(t)
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  const threshold = Math.max(3, Math.ceil(pagesWithData * 0.6))
  const repeated = new Set<string>()
  for (const [line, n] of counts) if (n >= threshold) repeated.add(line)
  return repeated
}

/** Track the nearest preceding heading as each block's section title. */
function assignSections(blocks: ExtractedBlock[]): void {
  let current: string | null = null
  for (const b of blocks) {
    if (b.isHeading) {
      current = b.text
    } else {
      b.sectionTitle = current
    }
  }
}
