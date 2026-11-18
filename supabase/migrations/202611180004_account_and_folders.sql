begin;

grant delete on public.note_folders to authenticated;

create or replace function public.delete_my_daily_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  account_id uuid := auth.uid();
begin
  if account_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  delete from auth.users where id = account_id;
end;
$$;

revoke all on function public.delete_my_daily_account() from public, anon;
grant execute on function public.delete_my_daily_account() to authenticated;

commit;
