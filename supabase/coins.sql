-- ============================================================================
--  Oggame – Coins-Währung & Admin (server-sicher)
-- ============================================================================
--  Einspielen: Supabase SQL-Editor → komplett einfügen → Run.
--  Coins liegen in `wallets` und können NUR von Server-Funktionen geändert
--  werden (keine Schreib-Policy) – Clients können sie nicht fälschen.
--  Verdient werden Coins ausschließlich durch Kämpfe (PvP, siehe pvp.sql).
-- ============================================================================

-- ---------------------------------------------------------------- wallets
create table if not exists public.wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  coins   bigint not null default 0
);
alter table public.wallets enable row level security;
-- Jeder darf NUR seinen eigenen Kontostand lesen; schreiben nur via Funktionen.
drop policy if exists wallets_select on public.wallets;
create policy wallets_select on public.wallets for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------- game_admins
create table if not exists public.game_admins (
  user_id uuid primary key references public.profiles(id) on delete cascade
);
alter table public.game_admins enable row level security;
drop policy if exists game_admins_select on public.game_admins;
create policy game_admins_select on public.game_admins for select to authenticated using (true);

-- Admin festlegen (per E-Mail des Spielers)
insert into public.game_admins(user_id)
  select id from auth.users where email = 'andrelegsding@gmail.com'
  on conflict do nothing;

-- ============================================================================
--  Funktionen
-- ============================================================================

-- Wallet anlegen (falls nötig) und Kontostand liefern.
create or replace function public.ensure_wallet()
returns bigint language plpgsql security definer set search_path = public as $$
declare c bigint;
begin
  if auth.uid() is null then raise exception 'Nicht eingeloggt'; end if;
  insert into public.wallets(user_id) values (auth.uid()) on conflict do nothing;
  select coins into c from public.wallets where user_id = auth.uid();
  return coalesce(c, 0);
end $$;
grant execute on function public.ensure_wallet() to authenticated;

-- INTERN: Coins gutschreiben. Bewusst NICHT für Clients freigegeben.
create or replace function public.award_coins(uid uuid, amount int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if uid is null or amount is null or amount = 0 then return; end if;
  insert into public.wallets(user_id) values (uid) on conflict do nothing;
  update public.wallets set coins = greatest(0, coins + amount) where user_id = uid;
end $$;
revoke execute on function public.award_coins(uuid, int) from public;

-- Coins ausgeben (z. B. zum Überspringen). Atomar, mit Guthaben-Prüfung.
create or replace function public.spend_coins(amount int)
returns bigint language plpgsql security definer set search_path = public as $$
declare c bigint;
begin
  if auth.uid() is null then raise exception 'Nicht eingeloggt'; end if;
  if amount is null or amount <= 0 then raise exception 'Ungültiger Betrag'; end if;
  insert into public.wallets(user_id) values (auth.uid()) on conflict do nothing;
  update public.wallets set coins = coins - amount
    where user_id = auth.uid() and coins >= amount;
  if not found then raise exception 'Nicht genug Coins'; end if;
  select coins into c from public.wallets where user_id = auth.uid();
  return c;
end $$;
grant execute on function public.spend_coins(int) to authenticated;

-- Admin: Coins an einen Spieler vergeben (per Spielername).
create or replace function public.admin_grant_coins(target_username text, amount int)
returns bigint language plpgsql security definer set search_path = public as $$
declare tid uuid; c bigint;
begin
  if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
    raise exception 'Keine Admin-Rechte';
  end if;
  select id into tid from public.profiles where username = target_username;
  if tid is null then raise exception 'Spieler nicht gefunden'; end if;
  insert into public.wallets(user_id) values (tid) on conflict do nothing;
  update public.wallets set coins = greatest(0, coins + amount) where user_id = tid;
  select coins into c from public.wallets where user_id = tid;
  return c;
end $$;
grant execute on function public.admin_grant_coins(text, int) to authenticated;
