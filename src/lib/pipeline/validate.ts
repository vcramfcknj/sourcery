import { generateObject } from 'ai'
import { closedEvidenceModel, judgeModel } from '../ai/provider'
import { closedEvidenceOutputSchema, judgeOutputSchema } from '../ai/schemas'
import { buildClosedEvidencePrompt, buildJudgePrompt } from '../ai/prompts'
import type { CandidateWithContext } from './generate'
import { collapseWhitespace, isCannotDetermine } from './text'

/**
 * L2 - CLOSED-EVIDENCE ANSWER CHECK + L3 - INDEPENDENT JUDGE (PRD 18.1).
 *
 * These are the model-based layers. The whole point of layering is that a
 * validator that is "just another prompt to the same model" shares the
 * generator's blind spots - so L2 uses a DIFFERENT model shown ONLY the
 * evidence (it cannot peek at the chunk or the generator's explanation), and
 * L3 uses yet another model as an adversarial judge. A question advances only
 * if it clears every layer; any failure is a rejection with a reason.
 */

export type LayerOutcome = { pass: true } | { pass: false; reason: string }

/** Compare option text ignoring case + surrounding whitespace. */
function sameAnswer(a: string, b: string): boolean {
  return collapseWhitespace(a).toLowerCase() === collapseWhitespace(b).toLowerCase()
}

/**
 * L2: a separate call sees ONLY the evidence quote + question + options and
 * must independently pick the same answer. Mismatch or "cannot determine"
 * => reject (PRD 18.1).
 */
export async function runL2({ candidate }: CandidateWithContext): Promise<LayerOutcome> {
  try {
    const { object } = await generateObject({
      model: closedEvidenceModel(),
      schema: closedEvidenceOutputSchema,
      temperature: 0,
      // Transient 429s from the free tier must not silently become content
      // rejections - let the SDK back off and retry before we give up.
      maxRetries: 4,
      prompt: buildClosedEvidencePrompt(candidate),
    })
    if (isCannotDetermine(object.selectedAnswer)) {
      return { pass: false, reason: 'L2: answer cannot be determined from the evidence alone.' }
    }
    if (!sameAnswer(object.selectedAnswer, candidate.correctAnswer)) {
      return {
        pass: false,
        reason: `L2: independent answer ("${object.selectedAnswer}") differs from proposed ("${candidate.correctAnswer}").`,
      }
    }
    return { pass: true }
  } catch (err) {
    // A call that fails to produce parseable structured output is discarded (PRD 27.3).
    return { pass: false, reason: `L2: validator call failed (${err instanceof Error ? err.message : 'error'}).` }
  }
}

/**
 * L3: independent judge (different model/configuration) checks answerability,
 * single-correct-answer, distractor validity, and explanation grounding.
 */
export async function runL3({ candidate, chunkContent }: CandidateWithContext): Promise<LayerOutcome> {
  try {
    const { object } = await generateObject({
      model: judgeModel(),
      schema: judgeOutputSchema,
      temperature: 0,
      maxRetries: 4,
      prompt: buildJudgePrompt(candidate, chunkContent),
    })
    if (!object.valid || !object.sourceSupported) {
      return { pass: false, reason: `L3: judge rejected - ${object.reason}` }
    }
    return { pass: true }
  } catch (err) {
    return { pass: false, reason: `L3: judge call failed (${err instanceof Error ? err.message : 'error'}).` }
  }
}
