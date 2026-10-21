-- Row Level Security. Default deny; policies below open exactly what the product needs.
alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.daily_game_schedule enable row level security;
alter table public.game_results enable row level security;
alter table public.krillion_answers enable row level security;
alter table public.result_screenshots enable row level security;
alter table public.mystery_reveals enable row level security;
alter table public.mystery_game_reactions enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.group_activity enable row level security;
alter table public.group_challenges enable row level security;

-- profiles: self, plus people you share a group with
create policy profiles_select on public.profiles for select using (id = auth.uid() or public.shares_group_with(id));
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- games + schedule: readable by signed-in users; writes only via service role (admin curation)
create policy games_select on public.games for select to authenticated using (active);
create policy schedule_select on public.daily_game_schedule for select to authenticated using (game_date <= public.product_today());
-- (future days are hidden so the mystery game can't be peeked early)

-- game_results: own rows fully; others' rows only within shared groups and after join date
create policy results_select on public.game_results for select using (public.can_view_result(user_id, game_date));
create policy results_insert on public.game_results for insert with check (user_id = auth.uid());
create policy results_update on public.game_results for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy results_delete on public.game_results for delete using (user_id = auth.uid());

-- krillion answers: own always; others only if visible, the owner shares answers, and viewer has finished that day's Krillion
create policy answers_select on public.krillion_answers for select using (
  exists (
    select 1 from public.game_results r join public.profiles p on p.id = r.user_id
    where r.id = game_result_id
      and (r.user_id = auth.uid()
           or (public.can_view_result(r.user_id, r.game_date) and p.share_answers and public.has_finished(r.game_id, r.game_date)))));
create policy answers_write on public.krillion_answers for all
  using (exists (select 1 from public.game_results r where r.id = game_result_id and r.user_id = auth.uid()))
  with check (exists (select 1 from public.game_results r where r.id = game_result_id and r.user_id = auth.uid()));

-- screenshots: strictly private to the owner
create policy shots_all on public.result_screenshots for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reveals_all on public.mystery_reveals for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy reactions_all on public.mystery_game_reactions for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- groups
create policy groups_select on public.groups for select using (public.is_group_member(id));
create policy groups_update on public.groups for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy groups_delete on public.groups for delete using (owner_id = auth.uid());
-- creation goes through create_group()

create policy members_select on public.group_members for select using (public.is_group_member(group_id));
create policy members_leave on public.group_members for delete using (user_id = auth.uid() or exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));
-- joining goes through join_group_with_token()

create policy invites_select on public.group_invites for select using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));
create policy invites_insert on public.group_invites for insert with check (created_by = auth.uid() and exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));
create policy invites_update on public.group_invites for update using (exists (select 1 from public.groups g where g.id = group_id and g.owner_id = auth.uid()));

-- activity: members can read their groups' feed (rows are spoiler-free by construction); inserts via trigger only
create policy activity_select on public.group_activity for select using (public.is_group_member(group_id));

create policy challenges_select on public.group_challenges for select using (public.is_group_member(group_id));
create policy challenges_insert on public.group_challenges for insert with check (created_by = auth.uid() and public.is_group_member(group_id));
create policy challenges_delete on public.group_challenges for delete using (created_by = auth.uid());

-- aggregate, anonymous reaction sentiment (no user ids exposed)
create or replace view public.mystery_reaction_totals with (security_invoker = false) as
  select s.mystery_game_id as game_id, r.reaction, count(*)::int as n
  from public.mystery_game_reactions r join public.daily_game_schedule s on s.game_date = r.game_date
  group by 1, 2;
revoke all on public.mystery_reaction_totals from anon;
grant select on public.mystery_reaction_totals to authenticated;
