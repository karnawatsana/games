-- The Daily 3: core schema. Product timezone is America/New_York (see app code NEXT_PUBLIC_PRODUCT_TIMEZONE).
create extension if not exists pgcrypto;

create or replace function public.product_today() returns date
language sql stable as $$ select (now() at time zone 'America/New_York')::date $$;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  display_name text not null,
  avatar_path text,
  share_answers boolean not null default true,   -- privacy: let group members see Krillion answers
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-z0-9_.]{3,24}$')
);
create unique index profiles_username_key on public.profiles (lower(username));

-- ---------- games ----------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  official_url text not null,
  description text not null,
  category text not null,
  estimated_minutes int not null check (estimated_minutes between 1 and 60),
  logo_url text,
  score_type text not null check (score_type in ('points','multiplier','time','rank','completion_only')),
  score_direction text not null check (score_direction in ('higher_better','lower_better','none')),
  max_score numeric,
  result_parser_type text not null default 'manual',
  submission_methods text[] not null default '{manual}',
  is_permanent boolean not null default false,       -- Krillion, Fermi
  mystery_eligible boolean not null default false,
  is_fallback boolean not null default false,        -- explicitly configured safe fallback
  active boolean not null default true,
  verified_at timestamptz,                           -- set only after a human verified the checklist
  verification_notes text,
  created_at timestamptz not null default now(),
  constraint completion_has_no_direction check ((score_type = 'completion_only') = (score_direction = 'none'))
);
create unique index games_one_fallback on public.games (is_fallback) where is_fallback;

create table public.daily_game_schedule (
  id uuid primary key default gen_random_uuid(),
  game_date date not null unique,                    -- exactly one mystery game per calendar date
  mystery_game_id uuid not null references public.games(id),
  source text not null default 'scheduled' check (source in ('scheduled','auto','fallback')),
  created_at timestamptz not null default now()
);
create index on public.daily_game_schedule (mystery_game_id, game_date desc);

-- ---------- results (one canonical row per user/game/date) ----------
create table public.game_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id uuid not null references public.games(id),
  game_date date not null,
  score_data jsonb not null default '{}'::jsonb,     -- native representation, e.g. {"total":310} or {"multiplier":"2.4x"}
  score_numeric numeric,                             -- sortable copy of the native score (never summed across games)
  submission_method text not null check (submission_method in ('share_text','screenshot','manual','integration')),
  verification_status text not null check (verification_status in ('verified','user_confirmed','unverified')),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_id, game_date)
);
create index on public.game_results (game_date, game_id);
create index on public.game_results (user_id, game_date desc);

create table public.krillion_answers (
  id uuid primary key default gen_random_uuid(),
  game_result_id uuid not null references public.game_results(id) on delete cascade,
  question_number int not null check (question_number between 1 and 7),
  question_text text not null,
  answer_text text not null,
  points int not null check (points between 0 and 100),
  rarity_indicator text,
  unique (game_result_id, question_number)
);

create table public.result_screenshots (
  id uuid primary key default gen_random_uuid(),
  game_result_id uuid not null references public.game_results(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

-- ---------- mystery reveal / reactions ----------
create table public.mystery_reveals (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_date date not null,
  revealed_at timestamptz not null default now(),
  primary key (user_id, game_date)
);
create table public.mystery_game_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_date date not null,
  reaction text not null check (reaction in ('loved','okay','not_for_me')),
  created_at timestamptz not null default now(),
  unique (user_id, game_date)
);

-- ---------- groups ----------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  joined_on date not null default public.product_today(),  -- results before this date stay private to the group
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);

create table public.group_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  token_hash text not null unique,                   -- sha256 of the token; the token itself is never stored
  expires_at timestamptz not null,
  max_uses int,
  uses int not null default 0,
  revoked_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_activity (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('completed_game','completed_daily_three','discovered_game','personal_best','joined_group')),
  game_id uuid references public.games(id),
  game_date date,
  created_at timestamptz not null default now()      -- deliberately no answer/score payload: spoiler-safe
);
create index on public.group_activity (group_id, created_at desc);

create table public.group_challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  kind text not null check (kind in ('total_games','everyone_finishes_today','daily_threes_in_week')),
  target int not null check (target > 0),
  starts_on date not null,
  ends_on date not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

-- ---------- helpers (security definer: avoid RLS recursion) ----------
create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid())
$$;

create or replace function public.shares_group_with(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = uid)
$$;

-- Can the current user see `owner`'s result for `d`? Same group, and the result is not older than
-- the viewer's join date (so history from before joining isn't exposed).
create or replace function public.can_view_result(owner uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid() or exists (
    select 1 from group_members me join group_members them on me.group_id = them.group_id
    where me.user_id = auth.uid() and them.user_id = owner
      and d >= me.joined_on and d >= them.joined_on)
$$;

-- Spoiler rule: answers for a date are visible only to people who finished that game that date.
create or replace function public.has_finished(gid uuid, d date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from game_results where user_id = auth.uid() and game_id = gid and game_date = d)
$$;

-- ---------- triggers ----------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger game_results_touch before update on public.game_results for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; cand text; n int := 0;
begin
  base := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), '[^a-zA-Z0-9_.]', '', 'g'));
  if char_length(base) < 3 then base := base || 'player'; end if;
  base := left(base, 20); cand := base;
  while exists (select 1 from profiles where lower(username) = cand) loop n := n + 1; cand := base || n::text; end loop;
  insert into profiles (id, username, display_name)
  values (new.id, cand, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), cand));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Spoiler-safe activity feed rows, created when a result is first saved.
create or replace function public.log_result_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare g_slug text; g_mystery boolean; first_time boolean; done_count int;
begin
  select slug, mystery_eligible and not is_permanent into g_slug, g_mystery from games where id = new.game_id;
  insert into group_activity (group_id, user_id, event_type, game_id, game_date)
    select group_id, new.user_id, 'completed_game', new.game_id, new.game_date from group_members where user_id = new.user_id;
  if g_mystery then
    select not exists (select 1 from game_results where user_id = new.user_id and game_id = new.game_id and id <> new.id) into first_time;
    if first_time then
      insert into group_activity (group_id, user_id, event_type, game_id, game_date)
        select group_id, new.user_id, 'discovered_game', new.game_id, new.game_date from group_members where user_id = new.user_id;
    end if;
  end if;
  select count(*) into done_count from game_results where user_id = new.user_id and game_date = new.game_date;
  if done_count = 3 then
    insert into group_activity (group_id, user_id, event_type, game_date)
      select group_id, new.user_id, 'completed_daily_three', new.game_date from group_members where user_id = new.user_id;
  end if;
  return new;
end $$;
create trigger game_results_activity after insert on public.game_results for each row execute function public.log_result_activity();

-- ---------- invites ----------
create or replace function public.join_group_with_token(token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare inv group_invites; h text := encode(digest(token, 'sha256'), 'hex');
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into inv from group_invites where token_hash = h for update;
  if not found or inv.revoked_at is not null or inv.expires_at < now() or (inv.max_uses is not null and inv.uses >= inv.max_uses) then
    raise exception 'invite is invalid or expired';
  end if;
  insert into group_members (group_id, user_id) values (inv.group_id, auth.uid()) on conflict do nothing;
  if found then
    update group_invites set uses = uses + 1 where id = inv.id;
    insert into group_activity (group_id, user_id, event_type) values (inv.group_id, auth.uid(), 'joined_group');
  end if;
  return inv.group_id;
end $$;

create or replace function public.create_group(group_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into groups (name, owner_id) values (trim(group_name), auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'owner');
  return gid;
end $$;
