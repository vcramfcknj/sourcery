import { INJECTION_PATTERNS } from '../constants'
import type { CandidateWithContext } from './generate'
import { collapseWhitespace, contentTokens } from './text'

/**
 * L1 - DETERMINISTIC CHECKS (PRD 18.1). No model, no cost, no blind spots:
 * this layer is why "100% of stored questions pass the verbatim-evidence
 * check" (PRD 30) is guaranteed rather than requested. Also implements the
 * PRD 27.3 rule that evidence which reads like an instruction to the model
 * is rejected outright.
 */

export type L1Result =
  | { pass: true; charStart: number; charEnd: number }
  | { pass: false; reason: string }

const TRICKY_OPTION = /\b(all|any)\s+of\s+the\s+above|\bnone\s+of\s+the\s+(above|these|options)\b/i

/**
 * Locate `quote` inside `content` as a verbatim substring, tolerating only
 * whitespace collapsing (extraction line-wraps), never word changes. Returns
 * the character range in the ORIGINAL content coordinates so the stored
 * source_char_start/source_char_end match the evidence exactly (PRD 18.1).
 */
export function findVerbatimRange(content: string, quote: string): { charStart: number; charEnd: number } | null {
  const direct = content.indexOf(quote)
  if (direct >= 0) return { charStart: direct, charEnd: direct + quote.length }

  // Whitespace-flexible fallback: build the collapsed content plus an index
  // map back to raw positions, then locate the collapsed quote inside it.
  const map: number[] = []
  let collapsed = ''
  let inWs = false
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (/\s/.test(ch)) {
      if (!inWs && collapsed.length > 0) {
        collapsed += ' '
        map.push(i)
      }
      inWs = true
      continue
    }
    inWs = false
    collapsed += ch
    map.push(i)
  }
  const cq = collapseWhitespace(quote)
  if (!cq) return null
  const at = collapsed.indexOf(cq)
  if (at < 0) return null
  const charStart = map[at]
  const charEnd = map[Math.min(at + cq.length - 1, map.length - 1)] + 1
  return { charStart, charEnd }
}

export function runL1({ candidate, chunkContent }: CandidateWithContext): L1Result {
  const fail = (reason: string): L1Result => ({ pass: false, reason })

  // --- Evidence must be a verbatim substring of the source chunk ---------
  const range = findVerbatimRange(chunkContent, candidate.evidenceQuote)
  if (!range) {
    return fail('Evidence quote is not a verbatim substring of the source chunk.')
  }

  // --- Prompt-injection defense (PRD 27.3): evidence that reads like a
  //     command to the model is rejected deterministically. -------------
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(candidate.evidenceQuote)) {
      return fail('Evidence quote reads like an instruction to the model.')
    }
  }

  // --- Structure checks ----------------------------------------------------
  const options = candidate.options.map((o) => o.trim())
  if (candidate.type === 'multiple_choice') {
    if (options.length !== 4) return fail('Multiple-choice question must have exactly 4 options.')
    const norm = options.map((o) => o.toLowerCase())
    if (new Set(norm).size !== norm.length) return fail('Multiple-choice question has duplicate options.')
    if (!options.some((o) => o === candidate.correctAnswer)) {
      return fail('Correct answer is not one of the options.')
    }
    if (options.some((o) => TRICKY_OPTION.test(o))) return fail('Option uses all/none-of-the-above wording.')
  } else if (candidate.type === 'true_false') {
    const sorted = [...options].sort().join('|')
    if (sorted !== 'False|True') return fail('True/False question options must be exactly True and False.')
    if (candidate.correctAnswer !== 'True' && candidate.correctAnswer !== 'False') {
      return fail('True/False correct answer must be "True" or "False".')
    }
    // A faithful/contradicted statement must share real terms with its evidence.
    const evTerms = contentTokens(collapseWhitespace(candidate.evidenceQuote))
    const qTerms = contentTokens(candidate.question)
    let shared = 0
    for (const t of qTerms) if (evTerms.has(t)) shared += 1
    if (shared < 2) return fail('Statement shares too few terms with its evidence.')
  }
  // identification carries no options; its only structural requirement is the
  // grounding check below (the typed term must be traceable to the evidence).

  // --- Correct answer's key terms appear in the evidence (MC + identification) --
  if (candidate.type === 'multiple_choice' || candidate.type === 'identification') {
    const evText = collapseWhitespace(candidate.evidenceQuote).toLowerCase()
    // Identification may list a few slash-separated accepted forms; any one
    // of them being grounded is enough.
    const answers = candidate.type === 'identification' ? candidate.correctAnswer.split('/') : [candidate.correctAnswer]
    const grounded = answers.some((a) => {
      const keyTerms = [...contentTokens(a)]
      return keyTerms.length > 0 && keyTerms.some((t) => evText.includes(t))
    })
    if (!grounded) {
      return fail("Correct answer's key terms do not appear in the evidence.")
    }
  }

  return { pass: true, ...range }
}
