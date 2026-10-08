-- ===========================================================================
-- 0003 - Printable flashcards module (TRIAL)
-- Front/back cards generated on demand from a reviewer's existing chunks.
-- Same ownership rules as questions: clients READ their own deck only;
-- writes happen exclusively through the service-role backend.
-- Idempotent so it can be applied by scripts/migrate-flashcards.ts.
-- ===========================================================================

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.reviewers (id) on delete cascade,
  order_index int not null,
  front text not null check (char_length(front) between 1 and 300),
  back text not null check (char_length(back) between 1 and 800),
  source_page int,               -- nullable locator, same convention as questions
  source_section text,
  created_at timestamptz not null default now(),
  unique (reviewer_id, order_index)
);

create index if not exists flashcards_reviewer_idx on public.flashcards (reviewer_id);

alter table public.flashcards enable row level security;

-- Drop-and-recreate so re-running the migration is safe.
drop policy if exists flashcards_select on public.flashcards;
create policy flashcards_select on public.flashcards
  for select using (public.owns_reviewer(reviewer_id));
-- No client insert/update/delete policies: the deck is written by the
-- server-side generator with the service role, and deleting the reviewer
-- cascades the deck away with everything else.
