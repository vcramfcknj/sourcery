-- ===========================================================================
-- Sourcery initial schema (PRD v1.1, Section 26)
-- Phase 1 deliverable: all MVP tables, RLS on every table (PRD 27.1),
-- hard-delete cascades (decision: no soft delete), indexes, private storage.
--
-- Apply via Supabase SQL editor or `supabase db push`.
-- Run AFTER enabling Supabase Auth (email confirmations on signup - PRD 8/10,
-- Open Question #10 decision: required).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profiles - extends auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mirror every new auth user into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.updated_at fresh.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- reviewers (PRD 26.2; hard delete decision - no deleted_at column)
-- ---------------------------------------------------------------------------
create table public.reviewers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'uploaded' check (status in (
    'uploaded', 'processing', 'extracting', 'structuring',
    'awaiting_verification', 'generating', 'validating', 'ready', 'failed'
  )),
  requested_question_count int not null check (requested_question_count between 1 and 20),
  question_count int not null default 0 check (question_count >= 0),
  question_types jsonb not null default '["multiple_choice"]'::jsonb,
  difficulty text not null default 'mixed' check (difficulty in ('easy', 'medium', 'hard', 'mixed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reviewers_updated_at
  before update on public.reviewers
  for each row execute function public.set_updated_at();

create index reviewers_user_idx on public.reviewers (user_id);

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.reviewers (id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size bigint not null,
  storage_path text not null, -- private bucket: source-documents/{user_id}/{reviewer_id}/...
  page_count int,            -- nullable: DOCX has no pages (PRD 14.1)
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'extracted', 'failed')),
  text_quality_score numeric, -- PRD 15.1 gate; tuned against fixtures
  created_at timestamptz not null default now()
);

create index documents_reviewer_idx on public.documents (reviewer_id);

-- ---------------------------------------------------------------------------
-- document_chunks - format-agnostic source locators (PRD 14.1)
-- ---------------------------------------------------------------------------
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index int not null,
  page_number int,                 -- nullable, PDF only
  section_title text,              -- nearest heading
  paragraph_index int,             -- position within document
  char_start int not null,
  char_end int not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index) -- idempotent re-extraction can upsert, never duplicate (PRD 13.2)
);

create index document_chunks_document_idx on public.document_chunks (document_id);

-- ---------------------------------------------------------------------------
-- generation_jobs (PRD 13.2) - pg-boss carries the actual queue; this table
-- is the user-visible job record (status, stage, error, attempt count).
-- ---------------------------------------------------------------------------
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.reviewers (id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  stage text not null default 'queued',
  error_code text,
  error_message text,
  attempt_count int not null default 0,
  started_at timestamptz,
  finished_at timestamptz
);

create index generation_jobs_reviewer_idx on public.generation_jobs (reviewer_id);

-- ---------------------------------------------------------------------------
-- questions (PRD 20/26.2) - immutable once attempted: edits create a new
-- version row (PRD 20 decision), enforced at the server layer.
-- ---------------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.reviewers (id) on delete cascade,
  order_index int not null,
  type text not null check (type in ('multiple_choice', 'true_false')),
  question text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text not null,
  source_chunk_id uuid not null references public.document_chunks (id) on delete cascade,
  source_page int,
  source_section text,
  source_text text not null, -- verbatim evidence quote, validated by L1
  source_char_start int not null,
  source_char_end int not null,
  topic text,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard')),
  version int not null default 1,
  created_at timestamptz not null default now(),
  unique (reviewer_id, order_index)
);

create index questions_reviewer_idx on public.questions (reviewer_id);

-- ---------------------------------------------------------------------------
-- rejected_questions (PRD 18.1) - internal quality metrics, never client-read
-- ---------------------------------------------------------------------------
create table public.rejected_questions (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.reviewers (id) on delete cascade,
  candidate jsonb not null,
  failed_layer text not null check (failed_layer in (
    'L1_deterministic', 'L2_closed_evidence', 'L3_judge', 'L4_deduplication'
  )),
  reason text not null,
  created_at timestamptz not null default now()
);

create index rejected_questions_reviewer_idx on public.rejected_questions (reviewer_id);

-- ---------------------------------------------------------------------------
-- question_reports (PRD 23.4)
-- ---------------------------------------------------------------------------
create table public.question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  reason text not null,
  note text,
  created_at timestamptz not null default now()
);

create index question_reports_question_idx on public.question_reports (question_id);

-- ---------------------------------------------------------------------------
-- attempts (PRD 24.2)
-- ---------------------------------------------------------------------------
create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.reviewers (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  shuffle_seed int not null, -- stored so review screens show consistent order
  score int,                 -- computed server-side only (PRD 26.3)
  total_questions int not null,
  percentage numeric(5,2),   -- computed server-side only
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index attempts_reviewer_idx on public.attempts (reviewer_id);

-- Exactly one in-progress attempt per reviewer per user (PRD 21.5/26.3).
create unique index attempts_one_in_progress
  on public.attempts (reviewer_id, user_id)
  where status = 'in_progress';

-- ---------------------------------------------------------------------------
-- attempt_answers (PRD 26.2)
-- ---------------------------------------------------------------------------
create table public.attempt_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  question_version int not null,
  user_answer text, -- null = skipped -> counted incorrect (PRD 21.6)
  is_correct boolean not null, -- computed server-side only
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index attempt_answers_attempt_idx on public.attempt_answers (attempt_id);

-- ===========================================================================
-- ROW LEVEL SECURITY (PRD 27.1: on every table)
-- Writes for internal tables (chunks, jobs, rejected_questions) happen via
-- the service-role backend only; clients get read access where the UX needs
-- it and nothing more.
-- ===========================================================================

alter table public.profiles enable row level security;
alter table public.reviewers enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.questions enable row level security;
alter table public.rejected_questions enable row level security;
alter table public.question_reports enable row level security;
alter table public.attempts enable row level security;
alter table public.attempt_answers enable row level security;

-- profiles: own row only
create policy profiles_select on public.profiles
  for select using (auth.uid() = id);
create policy profiles_update on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
-- insert handled by security-definer trigger; no client insert policy.

-- reviewers: full crud on own rows
create policy reviewers_select on public.reviewers
  for select using (auth.uid() = user_id);
create policy reviewers_insert on public.reviewers
  for insert with check (auth.uid() = user_id);
create policy reviewers_update on public.reviewers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy reviewers_delete on public.reviewers
  for delete using (auth.uid() = user_id); -- cascades to all child rows

-- Helper: reviewer ownership check for child tables (avoids repeating joins).
create or replace function public.owns_reviewer(reviewer uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.reviewers r
    where r.id = reviewer and r.user_id = auth.uid()
  );
$$;

-- documents: read own; insert/update via service-role backend only
-- (upload flow is a server operation in Phase 2).
create policy documents_select on public.documents
  for select using (public.owns_reviewer(reviewer_id));

-- document_chunks: read own only (generation writes are backend-side).
create policy chunks_select on public.document_chunks
  for select using (
    exists (select 1 from public.documents d
            where d.id = document_id and public.owns_reviewer(d.reviewer_id))
  );

-- generation_jobs: read own only.
create policy jobs_select on public.generation_jobs
  for select using (public.owns_reviewer(reviewer_id));

-- questions: read own only (creation/validation are backend-side; the
-- correct_answer column is therefore never exposed cross-user, and the
-- review UI hides it client-side until an attempt completes).
create policy questions_select on public.questions
  for select using (public.owns_reviewer(reviewer_id));

-- rejected_questions: no client access at all (internal quality metrics).
-- RLS enabled with zero policies = readable/writable by service role only.

-- question_reports: users may report questions on their own reviewers;
-- read own reports.
create policy reports_insert on public.question_reports
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.questions q where q.id = question_id and public.owns_reviewer(q.reviewer_id))
  );
create policy reports_select on public.question_reports
  for select using (auth.uid() = user_id);

-- attempts: full crud on own attempts.
create policy attempts_select on public.attempts
  for select using (auth.uid() = user_id);
create policy attempts_insert on public.attempts
  for insert with check (auth.uid() = user_id and public.owns_reviewer(reviewer_id));
create policy attempts_update on public.attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy attempts_delete on public.attempts
  for delete using (auth.uid() = user_id);

-- attempt_answers: crud where the caller owns the parent attempt.
create policy answers_select on public.attempt_answers
  for select using (
    exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid())
  );
create policy answers_insert on public.attempt_answers
  for insert with check (
    exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid())
  );
create policy answers_update on public.attempt_answers
  for update using (
    exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.attempts a where a.id = attempt_id and a.user_id = auth.uid())
  );

-- ===========================================================================
-- STORAGE (PRD 27.1): private bucket, per-user folder prefix
-- Path convention: {user_id}/{reviewer_id}/{file_name}
-- No public URLs; serve via short-lived signed URLs from the server.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('source-documents', 'source-documents', false)
on conflict (id) do nothing;

create policy "source documents read own"
  on storage.objects for select
  using (bucket_id = 'source-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "source documents write own"
  on storage.objects for insert
  with check (bucket_id = 'source-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "source documents delete own"
  on storage.objects for delete
  using (bucket_id = 'source-documents' and (storage.foldername(name))[1] = auth.uid()::text);
