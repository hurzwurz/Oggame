-- ============================================================================
--  NEXARION – Battle Pass: täglicher Login + Streak-Belohnung (serverseitig)
-- ============================================================================
--  Voraussetzung: setup_extras.sql (profiles, wallets, award_coins) ausgeführt.
-- ============================================================================

create table if not exists public.daily_login (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  streak     int not null default 0,
  last_claim date,
  total      int not null default 0
);
alter table public.daily_login enable row level security;
drop policy if exists dl_select on public.daily_login;
create policy dl_select on public.daily_login for select to authenticated using (user_id = auth.uid());

-- Status: aktueller Streak + ob heute abholbar.
create or replace function public.daily_status()
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); rec public.daily_login%rowtype;
begin
  if me is null then raise exception 'Nicht eingeloggt'; end if;
  select * into rec from public.daily_login where user_id = me;
  return jsonb_build_object(
    'streak', coalesce(rec.streak, 0),
    'claimable', (rec.last_claim is distinct from current_date)
  );
end $$;
grant execute on function public.daily_status() to authenticated;

-- Tagesbelohnung abholen (einmal pro Tag). Belohnung steigt im 7er-Zyklus,
-- Streak zählt aufeinanderfolgende Tage.
create or replace function public.claim_daily()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); rec public.daily_login%rowtype;
  newstreak int; reward int; today date := current_date;
begin
  if me is null then raise exception 'Nicht eingeloggt'; end if;
  select * into rec from public.daily_login where user_id = me for update;
  if not found then
    newstreak := 1;
    insert into public.daily_login(user_id, streak, last_claim, total) values (me, 1, today, 1);
  elsif rec.last_claim = today then
    return jsonb_build_object('already', true, 'streak', rec.streak);
  else
    if rec.last_claim = today - 1 then newstreak := rec.streak + 1; else newstreak := 1; end if;
    update public.daily_login set streak = newstreak, last_claim = today, total = rec.total + 1 where user_id = me;
  end if;
  reward := 50 * (((newstreak - 1) % 7) + 1);  -- Tag 1..7 -> 50..350 Coins
  perform public.award_coins(me, reward);
  return jsonb_build_object('already', false, 'streak', newstreak, 'reward_coins', reward);
end $$;
grant execute on function public.claim_daily() to authenticated;
