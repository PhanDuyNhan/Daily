begin;

create table if not exists public.note_folders (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null,
  folder_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  body text not null default '' check (char_length(body) <= 50000),
  updated_at timestamptz not null default now(),
  foreign key (user_id, folder_id) references public.note_folders(user_id, id) on delete cascade
);

create index if not exists notes_owner_folder_idx on public.notes (user_id, folder_id);

alter table public.note_folders enable row level security;
alter table public.notes enable row level security;

drop policy if exists note_folders_owner on public.note_folders;
create policy note_folders_owner on public.note_folders for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists notes_owner on public.notes;
create policy notes_owner on public.notes for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.note_folders, public.notes from anon;
grant select, insert, update on public.note_folders to authenticated;
grant select, insert, update, delete on public.notes to authenticated;

commit;
