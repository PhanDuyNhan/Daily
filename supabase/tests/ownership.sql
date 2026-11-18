\set ON_ERROR_STOP on

begin;

select gen_random_uuid() as owner_id, gen_random_uuid() as other_id,
  gen_random_uuid() as task_id, gen_random_uuid() as folder_id,
  gen_random_uuid() as note_id \gset

insert into auth.users (id) values (:'owner_id'), (:'other_id');
set local role authenticated;
select set_config('request.jwt.claim.sub', :'owner_id', true);
insert into public.tasks (id, user_id, title, due_date, warning_days)
  values (:'task_id', auth.uid(), 'Ownership fixture', current_date, 5);
insert into public.note_folders (id, user_id, name)
  values (:'folder_id', auth.uid(), 'Ownership fixture');
insert into public.notes (id, user_id, folder_id, title)
  values (:'note_id', auth.uid(), :'folder_id', 'Ownership fixture');
update public.notes set body = 'Owner update' where id = :'note_id';

do $$
begin
  if (select warning_days from public.tasks where user_id = auth.uid()) is distinct from 5
    or (select body from public.notes where user_id = auth.uid()) is distinct from 'Owner update'
  then raise exception 'Owner read/write failed'; end if;
end $$;

select set_config('request.jwt.claim.sub', :'other_id', true);
select set_config('daily.test_folder', :'folder_id', true);
do $$
declare affected integer;
begin
  if exists (select from public.tasks) or exists (select from public.note_folders)
    or exists (select from public.notes) then raise exception 'Cross-account read'; end if;
  update public.tasks set title = 'Cross-account update';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account update'; end if;
  delete from public.note_folders;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-account delete'; end if;
  begin
    insert into public.notes (id, user_id, folder_id, title)
      values (gen_random_uuid(), auth.uid(), current_setting('daily.test_folder')::uuid, 'Other owner');
    raise exception 'Cross-account folder accepted';
  exception when foreign_key_violation then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', :'owner_id', true);
delete from public.note_folders where id = :'folder_id';
do $$
begin
  if exists (select from public.notes) then raise exception 'Folder cascade failed'; end if;
end $$;
select public.delete_my_daily_account();

reset role;
select set_config('daily.test_owner', :'owner_id', true);
select set_config('daily.test_other', :'other_id', true);
do $$
begin
  if exists (select from auth.users where id = current_setting('daily.test_owner')::uuid)
    or exists (select from public.tasks where user_id = current_setting('daily.test_owner')::uuid)
    or not exists (select from auth.users where id = current_setting('daily.test_other')::uuid)
  then raise exception 'Account deletion isolation failed'; end if;
  if has_table_privilege('anon', 'public.tasks', 'SELECT')
    or has_table_privilege('anon', 'public.note_folders', 'SELECT')
    or has_table_privilege('anon', 'public.notes', 'SELECT')
    or has_function_privilege('anon', 'public.delete_my_daily_account()', 'EXECUTE')
  then raise exception 'Unexpected anonymous grant'; end if;
end $$;

rollback;
