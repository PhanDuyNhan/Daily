begin;

create table if not exists public.task_reminder_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false
);

alter table public.task_reminder_preferences enable row level security;

drop policy if exists task_reminder_preferences_owner on public.task_reminder_preferences;
create policy task_reminder_preferences_owner on public.task_reminder_preferences
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.task_reminder_preferences from public, anon, authenticated;
grant select, insert, update on public.task_reminder_preferences to authenticated;

create table if not exists public.task_reminder_deliveries (
  task_id uuid not null references public.tasks(id) on delete cascade,
  due_date date not null,
  claim_token uuid,
  claimed_at timestamptz,
  window_started_at timestamptz,
  retry_after timestamptz,
  sent_at timestamptz,
  primary key (task_id, due_date)
);

alter table public.task_reminder_deliveries enable row level security;
revoke all on public.task_reminder_deliveries from public, anon, authenticated;

create index if not exists tasks_reminder_due_idx on public.tasks (due_date, id)
  where status <> 'done';

create or replace function public.claim_task_due_email(p_today date)
returns table (task_id uuid, deadline date, claim_token uuid, title text, email text)
language sql
security definer
set search_path = ''
as $$
  with candidate as (
    select t.id, t.due_date, t.title, u.email::text
    from public.tasks t
    join public.task_reminder_preferences p on p.user_id = t.user_id and p.enabled
    join auth.users u on u.id = t.user_id and u.email_confirmed_at is not null and u.email is not null
    left join public.task_reminder_deliveries d on d.task_id = t.id and d.due_date = t.due_date
    where t.status <> 'done'
      and t.due_date between p_today and p_today + t.warning_days
      and d.sent_at is null
      and (d.retry_after is null or d.retry_after <= now())
      and (d.claimed_at is null or d.claimed_at <= now() - interval '5 minutes')
      and (d.window_started_at is null or d.window_started_at > now() - interval '23 hours')
    order by t.due_date, t.id
    limit 1
    for update of t skip locked
  ), claimed as (
    insert into public.task_reminder_deliveries as delivery
      (task_id, due_date, claim_token, claimed_at, window_started_at)
    select id, due_date, gen_random_uuid(), now(), now() from candidate
    on conflict (task_id, due_date) do update
      set claim_token = excluded.claim_token,
          claimed_at = excluded.claimed_at,
          window_started_at = coalesce(delivery.window_started_at, excluded.window_started_at),
          retry_after = null
      where delivery.sent_at is null
        and (delivery.retry_after is null or delivery.retry_after <= now())
        and (delivery.claimed_at is null or delivery.claimed_at <= now() - interval '5 minutes')
        and (delivery.window_started_at is null or delivery.window_started_at > now() - interval '23 hours')
    returning delivery.task_id, delivery.due_date, delivery.claim_token
  )
  select c.task_id, c.due_date, c.claim_token, t.title, t.email
  from claimed c join candidate t on t.id = c.task_id;
$$;

create or replace function public.finish_task_due_email(
  p_task_id uuid, p_deadline date, p_claim_token uuid, p_sent boolean
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with changed as (
    update public.task_reminder_deliveries
    set sent_at = case when p_sent then now() else null end,
        retry_after = case when p_sent then null else now() + interval '1 hour' end,
        -- Only a rejected first attempt can end the uncertainty window.
        window_started_at = case when not p_sent and claimed_at = window_started_at then null else window_started_at end,
        claimed_at = null,
        claim_token = null
    where task_id = p_task_id and due_date = p_deadline and claim_token = p_claim_token and sent_at is null
    returning 1
  )
  select exists (select 1 from changed);
$$;

revoke all on function public.claim_task_due_email(date) from public, anon, authenticated;
revoke all on function public.finish_task_due_email(uuid, date, uuid, boolean) from public, anon, authenticated;
grant execute on function public.claim_task_due_email(date) to service_role;
grant execute on function public.finish_task_due_email(uuid, date, uuid, boolean) to service_role;

commit;
