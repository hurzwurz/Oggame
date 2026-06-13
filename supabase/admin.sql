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

-- Admin: vollständige Spielerliste (Name, Punkte, Coins, Bann-Status).
create or replace function public.admin_list_players()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
    raise exception 'Keine Admin-Rechte';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'username', p.username, 'points', p.points,
      'banned', p.is_banned, 'coins', coalesce(w.coins, 0)
    ) order by p.username)
    from public.profiles p
    left join public.wallets w on w.user_id = p.id
  ), '[]'::jsonb);
end $$;
grant execute on function public.admin_list_players() to authenticated;
