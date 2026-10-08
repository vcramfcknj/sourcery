import { createGroq } from '@ai-sdk/groq'
import { AI_MODELS } from '../constants'

/**
 * AI provider wiring (PRD 28.5, 27.2). Groq is the primary provider
 * (Phase 1 decision: free tier, contractually no training on inputs),
 * abstracted behind the Vercel AI SDK so providers stay swappable.
 *
 * This module runs inside the trusted worker/server process only. It is
 * intentionally NOT marked `server-only` because the pg-boss worker imports
 * it in a plain Node runtime (where that guard would throw); the GROQ key is
 * read from process.env here and never forwarded to any client module.
 *
 * Model split (Open Question #3, resolved): generation, the L2
 * closed-evidence check and the L3 judge each run on a DISTINCT model so
 * validation does not share the generator's blind spots (PRD 18.1).
 * Every stage is overridable via GROQ_GEN_MODEL / GROQ_L2_MODEL /
 * GROQ_L3_MODEL without touching code.
 *
 * Keys are server/worker-only and never reach the browser (PRD 27.2).
 * Calls have no tool access (PRD 27.3): we use generateObject, which is
 * pure structured output.
 */
function groq() {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY is not set (see .env.local.example).')
  return createGroq({ apiKey: key })
}

export function generationModel() {
  return groq()(AI_MODELS.GENERATION)
}

/** Independent answer-check model: temperature 0, sees ONLY the evidence. */
export function closedEvidenceModel() {
  return groq()(AI_MODELS.L2_CLOSED_EVIDENCE)
}

/** Judge model: a different model from both generation and L2 (PRD 18.1). */
export function judgeModel() {
  return groq()(AI_MODELS.L3_JUDGE)
}
