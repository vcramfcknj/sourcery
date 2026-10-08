/**
 * Shared text utilities for deterministic validation (L1) and dedupe (L4).
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'than', 'so', 'as',
  'of', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'is', 'are',
  'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did', 'has', 'have',
  'had', 'not', 'no', 'yes', 'that', 'this', 'these', 'those', 'it', 'its',
  'they', 'them', 'their', 'we', 'you', 'he', 'she', 'his', 'her', 'which',
  'what', 'when', 'where', 'who', 'whom', 'how', 'why', 'can', 'will',
  'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'about',
  'into', 'over', 'under', 'after', 'before', 'between', 'during', 'within',
  'without', 'each', 'every', 'some', 'any', 'all', 'most', 'more', 'less',
])

/** Collapse all whitespace runs to single spaces (for verbatim-substring matching). */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

/** Content-word tokens: lowercased, punctuation-stripped, stopwords removed. */
export function contentTokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  )
}

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word.toLowerCase())
}

/** Case/diacritic-insensitive-ish Jaccard similarity of two token sets. */
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  let inter = 0
  for (const t of a) if (b.has(t)) inter += 1
  return inter / (a.size + b.size - inter)
}

/** Answers that mean "the evidence alone is not enough" (L2 rejection signal). */
export function isCannotDetermine(answer: string): boolean {
  return /cannot\s+(determine|answer|say)|not\s+(possible|enough)|unclear/i.test(answer)
}
