-- ============================================================================
--  Oggame – Admin-Verwaltung: Spieler sperren/freigeben + Spielerliste
-- ============================================================================
--  Einspielen: Supabase SQL-Editor → komplett einfügen → Run.
--  Voraussetzung: setup_extras.sql (Coins/Admin/game_admins) wurde ausgeführt.
-- ============================================================================

alter table public.profiles add column if not exists is_banned boolean not null default false;

-- Schutz: is_banned darf nur von Admins geändert werden (kein Selbst-Entbannen).
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_banned is distinct from old.is_banned then
    if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
      new.is_banned := old.is_banned;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Admin: Spieler sperren/freigeben (per Spielername).
create or replace function public.admin_set_banned(target_username text, banned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
    raise exception 'Keine Admin-Rechte';
  end if;
  update public.profiles set is_banned = banned where username = target_username;
end $$;
grant execute on function public.admin_set_banned(text, boolean) to authenticated;

-- Admin: ALLE registrierten Accounts (auch nie eingeloggte), inkl. E-Mail.
create or replace function public.admin_list_players()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
    raise exception 'Keine Admin-Rechte';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'username', p.username,
      'email', u.email,
      'points', coalesce(p.points, 0),
      'banned', coalesce(p.is_banned, false),
      'coins', coalesce(w.coins, 0),
      'played', (p.id is not null)
    ) order by u.created_at desc)
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.wallets w on w.user_id = u.id
  ), '[]'::jsonb);
end $$;
grant execute on function public.admin_list_players() to authenticated;

-- Admin: Punkte/XP setzen (Level ergibt sich daraus: level = floor(sqrt(points/100))+1).
create or replace function public.admin_set_points(target_username text, pts bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
    raise exception 'Keine Admin-Rechte';
  end if;
  update public.profiles set points = greatest(0, pts) where username = target_username;
end $$;
grant execute on function public.admin_set_points(text, bigint) to authenticated;

-- Admin: Level direkt setzen (setzt die passende Punktzahl-Schwelle).
create or replace function public.admin_set_level(target_username text, lvl int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
    raise exception 'Keine Admin-Rechte';
  end if;
  update public.profiles
    set points = (100 * power(greatest(1, lvl) - 1, 2))::bigint
    where username = target_username;
end $$;
grant execute on function public.admin_set_level(text, int) to authenticated;

-- Admin: Ressourcen eines Spielers setzen (auf seinem Heimatplaneten).
create or replace function public.admin_set_resources(
  target_username text, m bigint, c bigint, d bigint, g bigint, ti bigint)
returns void language plpgsql security definer set search_path = public as $$
declare tid uuid; pid uuid;
begin
  if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
    raise exception 'Keine Admin-Rechte';
  end if;
  select id into tid from public.profiles where username = target_username;
  if tid is null then raise exception 'Spieler nicht gefunden'; end if;
  select id into pid from public.planets where owner = tid order by created_at limit 1;
  if pid is null then raise exception 'Spieler hat noch keinen Planeten'; end if;
  update public.planets set resources = jsonb_build_object(
    'metal', greatest(0, m), 'crystal', greatest(0, c), 'deuterium', greatest(0, d),
    'gold', greatest(0, g), 'titan', greatest(0, ti)
  ) where id = pid;
end $$;
grant execute on function public.admin_set_resources(text, bigint, bigint, bigint, bigint, bigint) to authenticated;
