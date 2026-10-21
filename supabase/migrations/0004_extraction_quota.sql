-- Quota log for paid vision calls. Written by the server (service role) only.
create table public.extraction_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.extraction_events (user_id, created_at desc);
alter table public.extraction_events enable row level security;
create policy extraction_own_select on public.extraction_events for select using (user_id = auth.uid());
