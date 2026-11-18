-- Run once in your own Supabase PostgreSQL SQL editor on a fresh deployment.
begin;
create table if not exists public.aether_examples (id text primary key, title text not null, description text not null);
create table if not exists public.aether_scans (id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade, report jsonb not null, triage jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index if not exists aether_scan_owner_date on public.aether_scans(user_id,created_at desc);
alter table public.aether_examples enable row level security;
alter table public.aether_scans enable row level security;
drop policy if exists read_sample_catalog on public.aether_examples;
create policy read_sample_catalog on public.aether_examples for select using (true);
drop policy if exists read_owned_scan_reports on public.aether_scans;
create policy read_owned_scan_reports on public.aether_scans for select to authenticated using (auth.uid()=user_id);
grant usage on schema public to anon,authenticated,service_role;
revoke all privileges on public.aether_scans,public.aether_examples from public,anon,authenticated;
grant select on public.aether_examples to anon,authenticated;
grant select on public.aether_scans to authenticated;
grant all privileges on public.aether_scans,public.aether_examples to service_role;
insert into public.aether_examples(id,title,description) values ('vulnerable-demo','Atlas · Review sample','Defensive review fixture with weak randomness and a dummy password.'),('secure-demo','Atlas · Secure baseline','Environment-backed credentials and cryptographic randomness.') on conflict(id) do nothing;
commit;
