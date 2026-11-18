\set ON_ERROR_STOP on

begin;
select gen_random_uuid() as owner_id, gen_random_uuid() as paused_id,
  gen_random_uuid() as unverified_id, gen_random_uuid() as reminder_id \gset

insert into auth.users (id, email, email_confirmed_at) values
  (:'owner_id', 'reminder-owner@example.invalid', now()),
  (:'paused_id', 'reminder-paused@example.invalid', now()),
  (:'unverified_id', 'reminder-unverified@example.invalid', null);

insert into public.task_reminder_preferences values
  (:'owner_id', true), (:'paused_id', false), (:'unverified_id', true);

insert into public.tasks (id, user_id, title, due_date, warning_days, status) values
  (:'reminder_id', :'owner_id', 'Due soon', '2030-01-17', 3, 'in_progress'),
  (gen_random_uuid(), :'owner_id', 'Completed', '2030-01-15', 3, 'done'),
  (gen_random_uuid(), :'owner_id', 'Already overdue', '2030-01-12', 3, 'todo'),
  (gen_random_uuid(), :'owner_id', 'Outside window', '2030-01-18', 0, 'todo'),
  (gen_random_uuid(), :'paused_id', 'Reminders disabled', '2030-01-15', 3, 'todo'),
  (gen_random_uuid(), :'unverified_id', 'Email unconfirmed', '2030-01-15', 3, 'todo');

set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
do $$
begin
  if (select count(*) from public.task_reminder_preferences) <> 1
    or has_function_privilege('authenticated', 'public.claim_task_due_email(date)', 'EXECUTE')
    or has_table_privilege('authenticated', 'public.task_reminder_deliveries', 'SELECT')
  then raise exception 'Reminder data accessible across the wrong boundary'; end if;
end $$;
reset role;

select set_config('daily.test_reminder', :'reminder_id', true);
set local role service_role;
do $$
declare
  claimed record;
  expected uuid := current_setting('daily.test_reminder')::uuid;
begin
  if exists (select * from public.claim_task_due_email('2030-01-13'))
  then raise exception 'Reminder available before its window'; end if;
  select * into claimed from public.claim_task_due_email('2030-01-14');
  if claimed.task_id is distinct from expected or claimed.email is distinct from 'reminder-owner@example.invalid'
  then raise exception 'Wrong task or recipient'; end if;
  if exists (select * from public.claim_task_due_email('2030-01-14'))
  then raise exception 'Active claim or ineligible task selected'; end if;
  if public.finish_task_due_email(expected, '2030-01-17', gen_random_uuid(), true)
  then raise exception 'Unmatched claim marked sent'; end if;
  if not public.finish_task_due_email(expected, '2030-01-17', claimed.claim_token, true)
  then raise exception 'Matching claim failed'; end if;
  if exists (select * from public.claim_task_due_email('2030-01-15'))
  then raise exception 'Sent task or ineligible task selected'; end if;
end $$;
reset role;

update public.tasks set due_date = '2030-01-18' where id = :'reminder_id';
set local role service_role;
do $$
declare
  claimed record;
begin
  select * into claimed from public.claim_task_due_email('2030-01-15');
  if claimed.deadline is distinct from '2030-01-18'::date
  then raise exception 'Rescheduled task did not get a new reminder'; end if;
  if not public.finish_task_due_email(claimed.task_id, claimed.deadline, claimed.claim_token, false)
  then raise exception 'Provider rejection was not recorded'; end if;
  if exists (select * from public.claim_task_due_email('2030-01-15'))
  then raise exception 'Failed delivery did not wait before retrying'; end if;
end $$;
reset role;

update public.task_reminder_deliveries set retry_after = now() - interval '1 second'
  where task_id = :'reminder_id' and due_date = '2030-01-18';
set local role service_role;
do $$
begin
  if not exists (select * from public.claim_task_due_email('2030-01-16'))
  then raise exception 'Reminder did not become eligible after the retry delay'; end if;
end $$;
reset role;
rollback;
