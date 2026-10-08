/**
 * Database row types mirroring the schema in supabase/migrations/0001_init.sql
 * (PRD 26.2). Keep in sync with the migration.
 */
import type { AttemptStatus, Difficulty, QuestionType, ReviewerMode, ReviewerStatus, ValidationLayer } from './constants'

export interface Profile {
  id: string // = auth.users.id
  display_name: string | null
  created_at: string
  updated_at: string
}

export interface Reviewer {
  id: string
  user_id: string
  name: string
  status: ReviewerStatus
  /** 'questions' (default) or 'flashcards_only' - see migration 0004. */
  mode: ReviewerMode
  requested_question_count: number
  question_count: number // actual, after validation/shortfall
  question_types: QuestionType[]
  difficulty: Difficulty
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  reviewer_id: string
  file_name: string
  file_type: string
  file_size: number
  storage_path: string
  page_count: number | null // PDF only, when reliably determinable (PRD 14.1)
  extraction_status: 'pending' | 'extracted' | 'failed'
  text_quality_score: number | null
  created_at: string
}

/** Chunk with format-agnostic source locators (PRD 14.1). */
export interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  page_number: number | null
  section_title: string | null
  paragraph_index: number | null
  char_start: number
  char_end: number
  content: string
  created_at: string
}

export interface GenerationJob {
  id: string
  reviewer_id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  stage: string
  error_code: string | null
  error_message: string | null
  attempt_count: number
  started_at: string | null
  finished_at: string | null
}

export interface Question {
  id: string
  reviewer_id: string
  order_index: number
  type: QuestionType
  question: string
  options: string[]
  correct_answer: string
  explanation: string
  source_chunk_id: string
  source_page: number | null
  source_section: string | null
  source_text: string // verbatim evidence quote (validated by L1)
  source_char_start: number
  source_char_end: number
  topic: string | null
  difficulty: Difficulty
  version: number
  created_at: string
}

export interface RejectedQuestion {
  id: string
  reviewer_id: string
  candidate: Record<string, unknown>
  failed_layer: ValidationLayer
  reason: string
  created_at: string
}

export interface QuestionReport {
  id: string
  question_id: string
  user_id: string
  reason: string
  note: string | null
  created_at: string
}

export interface Attempt {
  id: string
  reviewer_id: string
  user_id: string
  status: AttemptStatus
  shuffle_seed: number // per-attempt option/order shuffle (PRD 24.1)
  score: number | null // computed server-side only (PRD 26.3)
  total_questions: number
  percentage: number | null
  started_at: string
  completed_at: string | null
}

export interface AttemptAnswer {
  id: string
  attempt_id: string
  question_id: string
  question_version: number
  user_answer: string | null // null when skipped
  is_correct: boolean
  answered_at: string
}

/** Reviewer card view-model for the dashboard (PRD 9). */
export interface ReviewerCard {
  reviewer: Reviewer
  sourceFileName: string | null
  lastAttemptedAt: string | null
  latestScore: { score: number; total: number } | null
  hasInProgressAttempt: boolean
  /** Stored deck size - the deliverable count in 'flashcards_only' mode. */
  flashcardCount: number
}

/** Printable flashcards row (trial module, migration 0003). */
export interface Flashcard {
  id: string
  reviewer_id: string
  order_index: number
  front: string
  back: string
  source_page: number | null
  source_section: string | null
}
