create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  description text,
  due_date date not null,
  due_time time,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  tag text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_due_date_idx on public.tasks (user_id, due_date);
alter table public.tasks enable row level security;

create policy "users_select_own_tasks" on public.tasks for select to authenticated using ((select auth.uid()) = user_id);
create policy "users_insert_own_tasks" on public.tasks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "users_update_own_tasks" on public.tasks for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "users_delete_own_tasks" on public.tasks for delete to authenticated using ((select auth.uid()) = user_id);

revoke all privileges on table public.tasks from anon;
grant select, insert, update, delete on table public.tasks to authenticated;

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_set_updated_at before update on public.tasks
for each row execute function public.set_updated_at();
