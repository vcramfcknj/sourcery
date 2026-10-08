import {
  DECK_STAGE_LABELS,
  STAGE_LABELS,
  type ExtractionStage,
  type ReviewerMode,
} from '../constants'

/**
 * Pure description of the step lists the processing screen renders per mode
 * (PRD 13.3: the visible steps must be the steps the backend really runs, so
 * a deck must NOT show "Creating questions"). Kept free of any server-only or
 * client-only import so the smoke suite can assert it directly.
 */

const EXTRACTION_COMMON: ExtractionStage[] = [
  'queued',
  'downloading',
  'extracting',
  'structuring',
  'quality_check',
]

export function extractionStepsFor(mode: ReviewerMode): ExtractionStage[] {
  // Deck mode never pauses for verification - the quality gate is what
  // protects the AI spend, and the deck is the whole deliverable.
  return mode === 'flashcards_only'
    ? [...EXTRACTION_COMMON]
    : [...EXTRACTION_COMMON, 'awaiting_verification']
}

export function generationStepsFor(mode: ReviewerMode): ExtractionStage[] {
  return mode === 'flashcards_only'
    ? ['generating']
    : ['planning', 'generating', 'validating', 'selecting']
}

/** Stage label in the mode's own words. */
export function stageLabel(stage: ExtractionStage, mode: ReviewerMode): string {
  return (mode === 'flashcards_only' && DECK_STAGE_LABELS[stage]) || STAGE_LABELS[stage]
}
