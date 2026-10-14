-- Local-only stand-in for what Supabase provides. NOT part of the project migrations.
do $$ begin create role anon nologin;          exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb
);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema public to anon, authenticated, service_role;
-- Supabase grants these too, and without them any function that calls auth.uid()
-- directly (rather than from inside an RLS policy, which runs as the table owner)
-- fails with "permission denied for schema auth". Verified against the live
-- project with has_schema_privilege / has_function_privilege.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
