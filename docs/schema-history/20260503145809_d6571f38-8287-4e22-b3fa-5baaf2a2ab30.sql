ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS action_system text,
  ADD COLUMN IF NOT EXISTS practice_tracker text,
  ADD COLUMN IF NOT EXISTS reflection_questions text;