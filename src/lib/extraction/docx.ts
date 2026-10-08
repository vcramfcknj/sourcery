/**
 * DOCX extraction via mammoth (server/worker only). Converts to HTML with a
 * style map that surfaces headings, then walks block elements into the
 * intermediate ExtractedDoc model.
 *
 * DOCX has no fixed pages (PRD 14.1), so pageNumber is always null and the
 * locator falls back to section_title - the whole reason the schema made page
 * optional.
 */
import mammoth from 'mammoth'
import type { ExtractedBlock, ExtractedDoc } from './chunk'

interface HtmlBlock {
  tag: string
  text: string
}

export async function extractDocx(bytes: Uint8Array): Promise<ExtractedDoc> {
  const { value: html } = await mammoth.convertToHtml(
    { buffer: Buffer.from(bytes) },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
      ],
    },
  )

  const blocks: ExtractedBlock[] = []
  for (const el of parseBlocks(html)) {
    const text = el.text.replace(/\s+/g, ' ').trim()
    if (text.length < 2) continue
    const isHeading = /^h[1-3]$/.test(el.tag)
    blocks.push({ text, pageNumber: null, sectionTitle: null, isHeading })
  }

  assignSections(blocks)
  return { blocks, pageCount: null }
}

/**
 * Minimal, allocation-light block splitter. mammoth emits well-formed,
 * predictable HTML (headings, <p>, <ul>/<ol> with <li>, tables as <tr>/<td>).
 * We intentionally do not build a full DOM - only block-level text is needed,
 * and table cells are joined per row so a row stays one verbatim chunk
 * (PRD 14.3: never generate from a table whose cells can't be associated).
 */
function parseBlocks(html: string): HtmlBlock[] {
  const out: HtmlBlock[] = []
  const blockRe = /<(h[1-6]|p|li|tr)\b[^>]*>([\s\S]*?)<\/\1>/gi
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(html)) !== null) {
    const tag = m[1].toLowerCase()
    const raw = m[2]
    if (tag === 'tr') {
      // Row: join non-empty cells with ' | ' so header/value stay together.
      const cells: string[] = []
      const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi
      let c: RegExpExecArray | null
      while ((c = cellRe.exec(raw)) !== null) {
        const t = stripTags(c[1]).trim()
        if (t) cells.push(t)
      }
      if (cells.length) out.push({ tag: 'tr', text: cells.join(' | ') })
    } else {
      out.push({ tag, text: stripTags(raw) })
    }
  }
  return out
}

function stripTags(s: string): string {
  return s
    .replace(/<\/?(?:strong|em|b|i|u|span|a|sup|sub|br)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

function assignSections(blocks: ExtractedBlock[]): void {
  let current: string | null = null
  for (const b of blocks) {
    if (b.isHeading) current = b.text
    else b.sectionTitle = current
  }
}
