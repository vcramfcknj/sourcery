-- 0002: add the 'identification' question type.
-- Widens the questions.type CHECK constraint. Idempotent: the constraint is
-- dropped if present, then recreated with the enlarged allow-list.
alter table public.questions drop constraint if exists questions_type_check;

alter table public.questions
  add constraint questions_type_check
  check (type in ('multiple_choice', 'true_false', 'identification'));
