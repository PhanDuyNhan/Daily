alter table public.tasks
  add column if not exists warning_days integer not null default 1
  check (warning_days between 0 and 365);
