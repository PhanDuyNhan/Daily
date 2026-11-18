-- Use only in an empty, disposable PostgreSQL database.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);

create function auth.uid() returns uuid
language sql stable
as $$
  select current_setting('request.jwt.claim.sub', true)::uuid
$$;

grant usage on schema auth to authenticated;
