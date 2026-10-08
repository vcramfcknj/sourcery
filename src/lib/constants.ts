/**
 * Product-wide constants and enums, mirroring the PRD (Sourcery.docx).
 * Limits come from Section 11 - values are tunable here, and the same
 * values must be enforced server-side (client checks are convenience only).
 */

// ---------------------------------------------------------------------------
// Limits and quotas (PRD 11)
// ---------------------------------------------------------------------------
export const LIMITS = {
  MAX_FILE_SIZE_BYTES: 20 * 1024 * 1024, // 20 MB
  MAX_FILE_SIZE_LABEL: '20 MB',
  MAX_PAGES: 200,
  MAX_EXTRACTED_TOKENS: 150_000,
  MAX_QUESTIONS_PER_GENERATION: 20,
  MAX_GENERATIONS_PER_USER_PER_DAY: 5,
  MAX_ACTIVE_REVIEWERS_PER_USER: 25,
  JOB_AUTOMATIC_RETRIES: 2,
  ALLOWED_FILE_TYPES: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] as const,
  ALLOWED_FILE_EXTENSIONS: ['pdf', 'docx'] as const,
} as const

/** Question count quick-picks shown on Create Reviewer (PRD 10.1). */
export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const

// ---------------------------------------------------------------------------
// Auth (PRD 8) - the app enforces these server-side; Supabase project
// settings should mirror the minimum length (Auth -> Providers -> Email).
// ---------------------------------------------------------------------------
export const PASSWORD = {
  MIN_LENGTH: 8,
  /** Supabase's own hard cap - passphrases longer than this are rejected. */
  MAX_LENGTH: 72,
} as const

// ---------------------------------------------------------------------------
// Username policy (PRD 8 signup) - stored as profiles.display_name via the
// handle_new_user trigger. Enforced server-side; the form mirrors it only as
// live feedback.
// ---------------------------------------------------------------------------
export const USERNAME = {
  MIN_LENGTH: 3,
  MAX_LENGTH: 30,
  /** letters, numbers, dots, underscores, hyphens - no spaces or symbols. */
  PATTERN: /^[A-Za-z0-9._-]+$/,
} as const

// ---------------------------------------------------------------------------
// Reviewer lifecycle states (PRD 13.3) - each maps to a real backend stage
// ---------------------------------------------------------------------------
export const REVIEWER_STATUSES = [
  'uploaded',
  'processing',
  'extracting',
  'structuring',
  'awaiting_verification',
  'generating',
  'validating',
  'ready',
  'failed',
] as const
export type ReviewerStatus = (typeof REVIEWER_STATUSES)[number]

/** Statuses that mean background work is currently running. */
export const IN_PROGRESS_STATUSES: readonly ReviewerStatus[] = [
  'uploaded',
  'processing',
  'extracting',
  'structuring',
  'generating',
  'validating',
]

// ---------------------------------------------------------------------------
// Creation modes. A deck is NOT a parallel entity: it is a reviewer whose
// deliverable is the printable flashcard deck instead of questions - one data
// model, one lifecycle, one delete cascade. The mode decides what the worker
// builds after extraction and which screen the detail route shows.
// ---------------------------------------------------------------------------
export const REVIEWER_MODES = ['questions', 'flashcards_only'] as const
export type ReviewerMode = (typeof REVIEWER_MODES)[number]

export const REVIEWER_MODE_LABELS: Record<ReviewerMode, string> = {
  questions: 'Questions + flashcards',
  flashcards_only: 'Flashcards only',
}

// ---------------------------------------------------------------------------
// Question configuration (PRD 10.1, 16, 19)
// ---------------------------------------------------------------------------
export const QUESTION_TYPES = ['multiple_choice', 'true_false', 'identification'] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
  identification: 'Identification',
}

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'mixed'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  mixed: 'Mixed',
}

/** Mixed target mix (PRD 16.4): ~40% easy, 40% medium, 20% hard. */
export const MIXED_DIFFICULTY_TARGETS = { easy: 0.4, medium: 0.4, hard: 0.2 } as const

// ---------------------------------------------------------------------------
// Attempts (PRD 24)
// ---------------------------------------------------------------------------
export const ATTEMPT_STATUSES = ['in_progress', 'completed'] as const
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number]

// ---------------------------------------------------------------------------
// Validation layers (PRD 18.1) - recorded on rejected_questions
// ---------------------------------------------------------------------------
export const VALIDATION_LAYERS = ['L1_deterministic', 'L2_closed_evidence', 'L3_judge', 'L4_deduplication'] as const
export type ValidationLayer = (typeof VALIDATION_LAYERS)[number]

// ---------------------------------------------------------------------------
// Question reports (PRD 23.4)
// ---------------------------------------------------------------------------
export const REPORT_REASONS = [
  'Wrong answer',
  'Not in my material',
  'Unclear or ambiguous',
  'Duplicate',
  'Other',
] as const

// ---------------------------------------------------------------------------
// Storage bucket (PRD 27.1 - private, signed URLs only)
// ---------------------------------------------------------------------------
export const DOCUMENTS_BUCKET = 'source-documents'

/** Storage object path convention: {user_id}/{reviewer_id}/{file_name} (PRD 27.1). */
export function documentStoragePath(userId: string, reviewerId: string, fileName: string): string {
  // Keep only a safe basename; RLS policy keys off the first path segment (user id).
  const safe = fileName.replace(/[^\w.\-]+/g, '_').slice(-120)
  return `${userId}/${reviewerId}/${safe}`
}

// ---------------------------------------------------------------------------
// Extraction pipeline (Phase 2)
// ---------------------------------------------------------------------------

/** Background job queue names handled by the pg-boss worker. */
export const JOBS = {
  EXTRACT_DOCUMENT: 'extract-document',
  GENERATE_QUESTIONS: 'generate-questions',
} as const

/**
 * Real stages a user sees while a document is processed (PRD 13.3/29.3).
 * Progress must map to these - never fake percentages. `stage` on
 * generation_jobs stores one of these values.
 */
export const EXTRACTION_STAGES = [
  'queued',
  'downloading',
  'extracting',
  'structuring',
  'quality_check',
  'awaiting_verification',
  'planning',
  'generating',
  'validating',
  'selecting',
  'completed',
  'failed',
] as const
export type ExtractionStage = (typeof EXTRACTION_STAGES)[number]

/**
 * Deck-mode overrides for the processing screen: the stage machine is the
 * same, only the wording changes ("questions" would be a lie for a deck).
 */
export const DECK_STAGE_LABELS: Partial<Record<ExtractionStage, string>> = {
  generating: 'Creating your flashcards',
}

/** User-facing labels for the processing screen (PRD 29.3). */
export const STAGE_LABELS: Record<ExtractionStage, string> = {
  queued: 'Queued',
  downloading: 'Reading your material',
  extracting: 'Reading your material',
  structuring: 'Organizing content',
  quality_check: 'Checking text quality',
  awaiting_verification: 'Waiting for you to confirm',
  planning: 'Planning question coverage',
  generating: 'Creating questions',
  validating: 'Checking answers against your material',
  selecting: 'Finalizing your reviewer',
  completed: 'Ready to review',
  failed: 'Something went wrong',
}

/**
 * Text-quality gate thresholds (PRD 15.1). Initial values; tuned against the
 * Section 35 fixtures. A document below MIN_USABLE_TEXT_RATIO of recognizable
 * characters, or under MIN_USABLE_CHARS total, is rejected before any AI cost.
 */
export const QUALITY = {
  MIN_USABLE_CHARS: 400, // total extracted characters to be worth generating from
  MIN_WORD_RATIO: 0.6, // fraction of tokens that look like real words
  MIN_SCORE: 0.35, // composite 0..1 below this blocks generation
} as const

/** Chunking targets for extraction (PRD 13.1/14). ~600-word windows with overlap. */
export const CHUNKING = {
  TARGET_WORDS: 400,
  MAX_CHARS: 3200,
  MIN_CHARS: 120,
  OVERLAP_SENTENCES: 1,
} as const

// ---------------------------------------------------------------------------
// Generation pipeline (Phase 3, PRD 16-18, 25, 27.3, 38)
// ---------------------------------------------------------------------------

/**
 * Processing-screen time estimates (PRD 13.3: honest progress, no faked
 * percentages). Anchored on measured runs - Groq free tier with the default
 * concurrency (gen 2 / validate 3), October 2026: 10 questions ~60-80s,
 * 5 questions ~35s, extraction with a live worker 1-2s.
 */
export const TIME_ESTIMATE = {
  /** Fixed pipeline work: planning + L4/selection + storage writes. */
  GEN_BASE_SECONDS: 20,
  GEN_PER_QUESTION_SECONDS: 6.5,
  EXTRACT_TYPICAL_SECONDS: 30,
  /** Deck mode: FLASHCARDS.MAX_CHUNKS calls at GENERATION_CONCURRENCY, no
   * validation layers - measured as "usually under a minute". */
  DECK_GEN_TYPICAL_SECONDS: 45,
  /** Still 'queued' this long (client-observed) almost certainly = no worker. */
  QUEUED_WARN_SECONDS: 45,
} as const

/**
 * AI model split (Open Question #3, resolved): three distinct Groq models
 * behind the Vercel AI SDK so the judge does not share the generator's
 * blind spots (PRD 18.1). Each stage is env-overridable without code edits.
 */
export const AI_MODELS = {
  GENERATION: process.env.GROQ_GEN_MODEL || 'openai/gpt-oss-120b',
  L2_CLOSED_EVIDENCE: process.env.GROQ_L2_MODEL || 'qwen/qwen3.8-27b',
  L3_JUDGE: process.env.GROQ_L3_MODEL || 'openai/gpt-oss-20b',
} as const

export const PIPELINE = {
  /** PRD 16.2: over-generate candidates so validation can trim without falling short. */
  OVER_GENERATION_FACTOR: 1.5,
  /** Bounded parallel AI calls: wall-time killer at MVP scale. Kept small so
   * a burst cannot trip Groq free-tier rate limits (429s are retried by the SDK). */
  GENERATION_CONCURRENCY: Number(process.env.GROQ_GEN_CONCURRENCY ?? 2),
  VALIDATION_CONCURRENCY: Number(process.env.GROQ_VALIDATE_CONCURRENCY ?? 3),
  /** Open Question #5, resolved: refuse a reviewer below 5 reliable questions. */
  MIN_VIABLE_QUESTIONS: 5,
  /** PRD 16.3: True statements must stay between 40% and 60% of a reviewer's T/F set. */
  TRUE_RATIO_MIN: 0.4,
  TRUE_RATIO_MAX: 0.6,
  /** Candidates requested per chunk-generation call (chunk size ~400 words). */
  CANDIDATES_PER_CALL: 3,
  /** L4 fact-key dedupe (Open Question #4, resolved): Jaccard token similarity cutoff. */
  DEDUPE_SIMILARITY: 0.7,
  /** Stricter cutoff when two candidates share the exact same source chunk. */
  DEDUPE_SAME_CHUNK_SIMILARITY: 0.5,
  /** Max candidate questions per reviewer call-loop to bound cost (PRD 11). */
  MAX_CANDIDATES_TOTAL: 60,
} as const

/**
 * Printable flashcards module (trial). Deliberately bounded: it is a
 * side-generation over chunks that already exist - never a new upload path.
 * Costs stay capped no matter how long the document is.
 */
export const FLASHCARDS = {
  /** Max chunks fed to the model (spread evenly across the document). */
  MAX_CHUNKS: 10,
  /** Cards asked for per chunk call; the model may return fewer or none. */
  CARDS_PER_CALL: 4,
  /** Hard ceiling on a printable deck (a physical sheet holds ~12 folded). */
  MAX_TOTAL: 36,
} as const

/**
 * Prompt-injection defense (PRD 27.3): source text is wrapped in these
 * delimiters and every prompt declares the contents to be data, never
 * instructions. Deterministic L1 also rejects evidence that reads like a
 * command to the model.
 */
export const SOURCE_OPEN_TAG = '<source_data>'
export const SOURCE_CLOSE_TAG = '</source_data>'

/** Imperative patterns that make a quote look like an injected instruction. */
export const INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(all\s+|any\s+)?(previous|prior|above)\s+instructions/i,
  /disregard\s+(all\s+|any\s+)?(previous|prior|above|your)\s+(instructions|rules|prompt)/i,
  /you\s+(must|should|will)\s+(answer|respond|output|say|generate)/i,
  /system\s+(prompt|message):/i,
  /(reveal|print|repeat)\s+(your|the)\s+(system\s+)?(prompt|instructions)/i,
]
