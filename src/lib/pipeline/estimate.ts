import { TIME_ESTIMATE } from '../constants'

/**
 * Honest wall-time estimates for the processing screen (PRD 13.3: real stages,
 * no faked progress). These are bounded by measured runs - Groq free tier,
 * default concurrency (gen 2 / validate 3), October 2026: a 10-question
 * reviewer generated in ~60-80s; a 5-question reviewer in ~35s; extraction
 * with a live worker is 1-2s. We show "usually about..." ranges plus real
 * elapsed time, never a percentage countdown.
 */

export interface TimeEstimate {
  minSec: number
  typicalSec: number
  maxSec: number
}

export function generationEstimate(questionCount: number): TimeEstimate {
  const n = Math.max(1, Math.round(questionCount || 0))
  const typical = Math.round(
    TIME_ESTIMATE.GEN_BASE_SECONDS + TIME_ESTIMATE.GEN_PER_QUESTION_SECONDS * n,
  )
  return {
    minSec: Math.round(typical * 0.7),
    typicalSec: typical,
    maxSec: Math.round(typical * 1.6),
  }
}

export function extractionEstimate(): TimeEstimate {
  return {
    minSec: 2,
    typicalSec: TIME_ESTIMATE.EXTRACT_TYPICAL_SECONDS,
    maxSec: TIME_ESTIMATE.EXTRACT_TYPICAL_SECONDS * 3,
  }
}

/**
 * Deck-mode build: FLASHCARDS.MAX_CHUNKS calls over an already-extracted
 * document, with no L2/L3 validation layer on top - so it is bounded by the
 * cap, not by how long the PDF is.
 */
export function deckEstimate(): TimeEstimate {
  const typical = TIME_ESTIMATE.DECK_GEN_TYPICAL_SECONDS
  return {
    minSec: Math.round(typical * 0.55),
    typicalSec: typical,
    maxSec: Math.round(typical * 2.2),
  }
}

/** Short human duration for estimates: 45s / 1 min / 1 min 30s / 2 min. */
export function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}s`
  if (s < 90) return '1 min'
  if (s < 120) return '1 min 30s'
  return `${Math.round(s / 60)} min`
}

/** Compact clock for elapsed time: 42s / 1m 05s / 12m 30s. */
export function formatElapsed(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r === 0 ? `${m} min` : `${m}m ${String(r).padStart(2, '0')}s`
}
