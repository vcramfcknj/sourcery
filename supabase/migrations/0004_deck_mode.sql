-- ===========================================================================
-- 0004 - "Flashcards only" creation mode
-- A deck is NOT a parallel entity: it is a reviewer whose deliverable is the
-- printable deck instead of questions (one data model, one lifecycle, one
-- delete cascade). So this is a mode flag on reviewers, nothing more.
--
-- requested_question_count widens to allow 0: a deck-mode reviewer requests
-- no questions, and 0 keeps the dashboard honest instead of storing a fake 1.
-- Idempotent so scripts/migrate-deck-mode.ts can re-apply it safely.
-- ===========================================================================

alter table public.reviewers
  add column if not exists mode text not null default 'questions';

-- Drop-and-recreate the allow-list check (0001 created it inline, unnamed ->
-- Postgres named it reviewers_mode_check; drop by that name first).
alter table public.reviewers drop constraint if exists reviewers_mode_check;
alter table public.reviewers
  add constraint reviewers_mode_check
  check (mode in ('questions', 'flashcards_only'));

alter table public.reviewers drop constraint if exists reviewers_requested_question_count_check;
alter table public.reviewers
  add constraint reviewers_requested_question_count_check
  check (requested_question_count between 0 and 20);
