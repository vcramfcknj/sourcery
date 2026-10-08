import { z } from 'zod'

/**
 * Structured-output contracts for every AI stage (PRD 27.3: structured
 * output is REQUIRED from every AI stage; anything that fails parsing is
 * discarded). These are the only shapes the pipeline trusts - the models
 * can return nothing else that has any effect.
 */

// --- Generation -------------------------------------------------------------

export const candidateSchema = z.object({
  type: z.enum(['multiple_choice', 'true_false', 'identification']),
  question: z.string().min(8).max(400),
  /** Empty for identification (a typed free-text answer). */
  options: z.array(z.string().min(1).max(200)).max(4),
  correctAnswer: z.string().min(1).max(200),
  explanation: z.string().min(8).max(800),
  /** Verbatim substring of the source chunk - L1 checks this exactly. */
  evidenceQuote: z.string().min(8).max(1200),
  topic: z.string().min(1).max(120),
  difficulty: z.enum(['easy', 'medium', 'hard']),
})
export type Candidate = z.infer<typeof candidateSchema>

export const generationOutputSchema = z.object({
  /** Empty is a valid answer: "if the source cannot support a reliable
   * question, return nothing for that segment" (PRD 28.5). */
  candidates: z.array(candidateSchema).max(6),
})
export type GenerationOutput = z.infer<typeof generationOutputSchema>

// --- L2 closed-evidence answer check ---------------------------------------

export const closedEvidenceOutputSchema = z.object({
  /** Option text picked from the question's options, or exactly
   * "Cannot determine" when the evidence alone does not answer it. */
  selectedAnswer: z.string().max(200),
  reasoning: z.string().max(600),
})
export type ClosedEvidenceOutput = z.infer<typeof closedEvidenceOutputSchema>

// --- L3 independent judge ---------------------------------------------------

export const judgeOutputSchema = z.object({
  valid: z.boolean(),
  sourceSupported: z.boolean(),
  reason: z.string().max(600),
})
export type JudgeOutput = z.infer<typeof judgeOutputSchema>

// --- Printable flashcards (trial module) ------------------------------------

export const flashcardSchema = z.object({
  /** Card front: the term/label a student should recall. */
  term: z.string().min(2).max(200),
  /** Card back: a tight definition supported ONLY by the source. */
  definition: z.string().min(10).max(600),
})
export type FlashcardCard = z.infer<typeof flashcardSchema>

export const flashcardsOutputSchema = z.object({
  /** Empty is valid: chunks with nothing definable yield no cards. */
  cards: z.array(flashcardSchema).max(6),
})
export type FlashcardsOutput = z.infer<typeof flashcardsOutputSchema>
