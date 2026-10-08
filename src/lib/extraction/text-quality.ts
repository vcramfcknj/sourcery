/**
 * Text-quality scoring (PRD 15.1). Pure, dependency-free, and unit-testable
 * against the Section 35 fixtures (scanned PDF, garbled equations, etc.).
 *
 * The gate must be conservative: a low score blocks generation so we never
 * spend AI budget turning unreadable text into bad questions.
 */
import { QUALITY } from '../constants'

export interface QualityReport {
  score: number // 0..1 composite
  charCount: number
  wordCount: number
  wordRatio: number // recognizable words / total whitespace tokens
  garbledLineRatio: number // lines that look like noise
  passed: boolean
  reason?: string
}

// A "word-like" run: at least two letters, allowing common punctuation that
// appears inside real study text (hyphens, apostrophes, slashes, degrees).
const WORD_LIKE = /[A-Za-z]{2,}(?:['\/\-°][A-Za-z0-9]+)*/g

// Whitespace-delimited token that contains at least one letter.
const HAS_LETTER = /[A-Za-z]/

/**
 * Heuristic for a garbled line: high density of characters outside the normal
 * latin/number/punctuation set (typical of a mis-extracted equation or a
 * corrupt encoding). Deliberately simple; tuned against fixtures.
 */
function lineLooksGarbled(line: string): boolean {
  const trimmed = line.trim()
  if (trimmed.length < 8) return false
  const odd = (trimmed.match(/[^\x09\x0A\x0D\x20-\x7E]/g) ?? []).length
  return odd / trimmed.length > 0.3
}

export function scoreTextQuality(text: string): QualityReport {
  const charCount = text.length

  const tokens = text.split(/\s+/).filter(Boolean)
  const wordTokens = tokens.filter((t) => HAS_LETTER.test(t))
  const wordCount = (text.match(WORD_LIKE) ?? []).length
  const wordRatio = wordTokens.length === 0 ? 0 : wordCount / wordTokens.length

  const lines = text.split(/\r?\n/)
  const nonEmptyLines = lines.filter((l) => l.trim().length > 0)
  const garbledLines = nonEmptyLines.filter(lineLooksGarbled)
  const garbledLineRatio =
    nonEmptyLines.length === 0 ? 1 : garbledLines.length / nonEmptyLines.length

  // Not enough text at all -> hard fail before ratio math matters.
  if (charCount < QUALITY.MIN_USABLE_CHARS) {
    return {
      score: 0,
      charCount,
      wordCount,
      wordRatio,
      garbledLineRatio,
      passed: false,
      reason: 'Not enough usable text could be extracted from this document.',
    }
  }

  // Composite: half word-legibility, half freedom-from-garble.
  const legibility = clamp01(wordRatio)
  const cleanliness = clamp01(1 - garbledLineRatio)
  const score = 0.5 * legibility + 0.5 * cleanliness

  const passed = score >= QUALITY.MIN_SCORE
  return {
    score: round2(score),
    charCount,
    wordCount,
    wordRatio: round2(wordRatio),
    garbledLineRatio: round2(garbledLineRatio),
    passed,
    reason: passed
      ? undefined
      : 'The extracted text looks too garbled to produce reliable questions.',
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
