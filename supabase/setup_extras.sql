-- NEXARION – KOMPLETT-Setup (idempotent). Voraussetzung: schema.sql.

-- ## 1) ALLIANZEN & FREUNDE ##
-- ============================================================================
--  Soziale Features: Allianzen/Gilden & Freundschaften
-- ============================================================================

-- ---------------------------------------------------------------- alliances
create table if not exists public.alliances (
  id         uuid primary key default gen_random_uuid(),
  name       text unique not null check (char_length(name) between 2 and 40),
  tag        text unique not null check (char_length(tag) between 1 and 6),
  founder    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.alliance_members (
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member',
  joined_at   timestamptz not null default now(),
  primary key (alliance_id, user_id)
);
-- jeder Spieler nur in EINER Allianz
create unique index if not exists alliance_members_user_uniq on public.alliance_members(user_id);

alter table public.alliances        enable row level security;
alter table public.alliance_members enable row level security;

drop policy if exists alliances_select on public.alliances;
create policy alliances_select on public.alliances for select to authenticated using (true);
drop policy if exists alliances_insert on public.alliances;
create policy alliances_insert on public.alliances for insert to authenticated with check (auth.uid() = founder);
drop policy if exists alliances_delete on public.alliances;
create policy alliances_delete on public.alliances for delete to authenticated using (auth.uid() = founder);

drop policy if exists members_select on public.alliance_members;
create policy members_select on public.alliance_members for select to authenticated using (true);
drop policy if exists members_insert on public.alliance_members;
create policy members_insert on public.alliance_members for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists members_delete on public.alliance_members;
create policy members_delete on public.alliance_members for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------- friendships
create table if not exists public.friendships (
  id         uuid primary key default gen_random_uuid(),
  requester  uuid not null references public.profiles(id) on delete cascade,
  addressee  uuid not null references public.profiles(id) on delete cascade,
  status     text not null default 'pending',  -- pending | accepted
  created_at timestamptz not null default now(),
  unique (requester, addressee)
);
create index if not exists friendships_addressee_idx on public.friendships(addressee);

alter table public.friendships enable row level security;

drop policy if exists friendships_select on public.friendships;
create policy friendships_select on public.friendships
  for select to authenticated using (auth.uid() = requester or auth.uid() = addressee);
drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert to authenticated with check (auth.uid() = requester);
drop policy if exists friendships_update on public.friendships;
create policy friendships_update on public.friendships
  for update to authenticated using (auth.uid() = addressee);
drop policy if exists friendships_delete on public.friendships;
create policy friendships_delete on public.friendships
  for delete to authenticated using (auth.uid() = requester or auth.uid() = addressee);

-- ## 2) COINS & ADMIN ##
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

-- ## 3) PVP (sofort) ##
-- ============================================================================
--  Oggame – PvP (server-autoritativ, als DB-Funktion / RPC)
-- ============================================================================
--  Einspielen: Supabase SQL-Editor → komplett einfügen → Run.
--  Kampf läuft sicher in der DB (SECURITY DEFINER), Client kann nicht cheaten.
--  v1: sofortige Auflösung (ohne Flugzeit), vereinfachtes Kampfmodell.
-- ============================================================================

create table if not exists public.unit_stats (
  id        text primary key,
  kind      text not null,
  weapon    int not null default 0,
  structure int not null default 0,
  shield    int not null default 0,
  cargo     int not null default 0
);
alter table public.unit_stats enable row level security;
drop policy if exists unit_stats_select on public.unit_stats;
create policy unit_stats_select on public.unit_stats for select to authenticated using (true);

insert into public.unit_stats (id,kind,weapon,structure,shield,cargo) values
('smallCargo','ship',5,4000,10,5000),
('largeCargo','ship',5,12000,25,25000),
('hugeCargo','ship',10,70000,80,140000),
('tanker','ship',5,50000,60,90000),
('colonyShip','ship',50,30000,100,7500),
('recycler','ship',1,16000,10,20000),
('espionageProbe','ship',0,1000,0,5),
('solarSatellite','ship',1,2000,1,0),
('crawler','ship',1,4000,1,0),
('pathfinder','ship',200,23000,100,10000),
('lightFighter','ship',50,4000,10,50),
('heavyFighter','ship',150,10000,25,100),
('interceptor','ship',220,13000,40,120),
('corvette','ship',320,22000,60,400),
('cruiser','ship',400,27000,50,800),
('frigate','ship',700,45000,120,1200),
('battleship','ship',1000,60000,200,1500),
('battlecruiser','ship',700,70000,400,750),
('heavyCruiser','ship',900,75000,350,1500),
('bomber','ship',1000,75000,500,500),
('destroyer','ship',2000,110000,500,2000),
('plasmaCruiser','ship',2600,130000,700,1800),
('dreadnought','ship',3500,210000,900,2500),
('carrier','ship',1200,230000,800,30000),
('titan','ship',7000,600000,2000,8000),
('reaper','ship',2800,140000,700,10000),
('leviathan','ship',9000,900000,3500,12000),
('deathstar','ship',200000,9000000,50000,1000000),
('stealthShip','ship',1500,55000,300,2000),
('gunship','ship',1400,35000,200,600),
('ionFrigate','ship',1100,65000,600,1500),
('rocketLauncher','defense',80,2000,20,0),
('lightLaser','defense',100,2000,25,0),
('heavyLaser','defense',250,8000,100,0),
('gaussCannon','defense',1100,35000,200,0),
('ionCannon','defense',150,8000,500,0),
('plasmaTurret','defense',3000,100000,300,0),
('teslaTower','defense',1600,45000,400,0),
('railgun','defense',2200,60000,250,0),
('flakCannon','defense',450,12000,120,0),
('smallShieldDome','defense',1,20000,2000,0),
('largeShieldDome','defense',1,100000,10000,0),
('interplanetaryMissile','defense',12000,15000,1,0)
on conflict (id) do update set kind=excluded.kind, weapon=excluded.weapon, structure=excluded.structure, shield=excluded.shield, cargo=excluded.cargo;

-- ---------------------------------------------------------------- Angriff
create or replace function public.attack_player(t_g int, t_s int, t_p int, atk_ships jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  ap public.planets%rowtype;
  tp public.planets%rowtype;
  awm numeric; aam numeric; asm numeric; dwm numeric; dam numeric; dsm numeric;
  atk_w numeric; atk_hp numeric; def_w numeric; def_hp numeric;
  lossA numeric; lossD numeric; winner text;
  new_ap_ships jsonb; new_tp_ships jsonb := '{}'::jsonb; new_tp_def jsonb := '{}'::jsonb;
  loot_m bigint := 0; loot_c bigint := 0; loot_d bigint := 0; cap numeric := 0; freecap numeric;
  rec record; lost int; surviving int;
  R numeric := 3;
begin
  if me is null then raise exception 'Nicht eingeloggt'; end if;
  if atk_ships is null or atk_ships = '{}'::jsonb then raise exception 'Keine Schiffe ausgewählt'; end if;

  select * into ap from public.planets where owner = me order by created_at limit 1 for update;
  if not found then raise exception 'Kein eigener Planet'; end if;
  select * into tp from public.planets where galaxy=t_g and system=t_s and position=t_p for update;
  if not found then raise exception 'Ziel existiert nicht'; end if;
  if tp.owner = me then raise exception 'Du kannst dich nicht selbst angreifen'; end if;

  if exists (select 1 from jsonb_each_text(atk_ships) e
             where coalesce((ap.ships->>e.key)::int,0) < e.value::int) then
    raise exception 'Nicht genug Schiffe vorhanden';
  end if;

  awm := 1+0.1*coalesce((ap.research->>'weaponsTech')::int,0);
  aam := 1+0.1*coalesce((ap.research->>'armorTech')::int,0);
  asm := 1+0.1*coalesce((ap.research->>'shieldTech')::int,0);
  dwm := 1+0.1*coalesce((tp.research->>'weaponsTech')::int,0);
  dam := 1+0.1*coalesce((tp.research->>'armorTech')::int,0);
  dsm := 1+0.1*coalesce((tp.research->>'shieldTech')::int,0);

  select coalesce(sum(e.value::int*us.weapon),0),
         coalesce(sum(e.value::int*(us.structure*aam+us.shield*asm)),0)
    into atk_w, atk_hp
    from jsonb_each_text(atk_ships) e join public.unit_stats us on us.id=e.key;
  atk_w := atk_w*awm;

  select coalesce(sum(e.value::int*us.weapon),0),
         coalesce(sum(e.value::int*(us.structure*dam+us.shield*dsm)),0)
    into def_w, def_hp
    from jsonb_each_text(tp.ships||tp.defenses) e join public.unit_stats us on us.id=e.key;
  def_w := def_w*dwm;

  lossD := case when def_hp>0 then least(1.0,(atk_w*R)/def_hp) else 0 end;
  lossA := case when atk_hp>0 then least(1.0,(def_w*R)/atk_hp) else 0 end;
  if lossA>=1 and lossD>=1 then winner:='draw';
  elsif lossA>=1 then winner:='defender';
  elsif lossD>=1 then winner:='attacker';
  else winner:='draw'; end if;

  new_ap_ships := ap.ships;
  for rec in select key,value from jsonb_each_text(atk_ships) loop
    lost := floor(rec.value::int*lossA);
    new_ap_ships := jsonb_set(new_ap_ships, array[rec.key],
      to_jsonb(greatest(0, coalesce((new_ap_ships->>rec.key)::int,0)-lost)));
  end loop;
  for rec in select key,value from jsonb_each_text(tp.ships) loop
    lost := floor(rec.value::int*lossD);
    new_tp_ships := jsonb_set(new_tp_ships, array[rec.key], to_jsonb(greatest(0, rec.value::int-lost)), true);
  end loop;
  for rec in select key,value from jsonb_each_text(tp.defenses) loop
    lost := floor(rec.value::int*lossD); surviving := rec.value::int-lost;
    new_tp_def := jsonb_set(new_tp_def, array[rec.key], to_jsonb(surviving + floor(lost*0.7)), true);
  end loop;

  if winner='attacker' then
    select coalesce(sum( greatest(0, e.value::int - floor(e.value::int*lossA)) * us.cargo),0)
      into cap from jsonb_each_text(atk_ships) e join public.unit_stats us on us.id=e.key;
    freecap := cap;
    loot_m := least(floor(coalesce((tp.resources->>'metal')::numeric,0)*0.5), freecap); freecap:=freecap-loot_m;
    loot_c := least(floor(coalesce((tp.resources->>'crystal')::numeric,0)*0.5), freecap); freecap:=freecap-loot_c;
    loot_d := least(floor(coalesce((tp.resources->>'deuterium')::numeric,0)*0.5), freecap); freecap:=freecap-loot_d;
  end if;

  update public.planets set ships=new_ap_ships,
    resources = jsonb_build_object(
      'metal',    coalesce((ap.resources->>'metal')::numeric,0)+loot_m,
      'crystal',  coalesce((ap.resources->>'crystal')::numeric,0)+loot_c,
      'deuterium',coalesce((ap.resources->>'deuterium')::numeric,0)+loot_d)
  where id=ap.id;
  update public.planets set ships=new_tp_ships, defenses=new_tp_def,
    resources = jsonb_build_object(
      'metal',    greatest(0, coalesce((tp.resources->>'metal')::numeric,0)-loot_m),
      'crystal',  greatest(0, coalesce((tp.resources->>'crystal')::numeric,0)-loot_c),
      'deuterium',greatest(0, coalesce((tp.resources->>'deuterium')::numeric,0)-loot_d))
  where id=tp.id;

  insert into public.reports(owner,type,payload) values
    (me, 'pvp_attack', jsonb_build_object('target',jsonb_build_array(t_g,t_s,t_p),
        'winner',winner,'loot',jsonb_build_object('metal',loot_m,'crystal',loot_c,'deuterium',loot_d))),
    (tp.owner, 'pvp_defense', jsonb_build_object('from',jsonb_build_array(ap.galaxy,ap.system,ap.position),
        'winner',winner,'loot',jsonb_build_object('metal',loot_m,'crystal',loot_c,'deuterium',loot_d)));

  -- Coins als Kampfbelohnung (nur durch Kämpfe verdienbar)
  if winner = 'attacker' then perform public.award_coins(me, 10);
  elsif winner = 'defender' then perform public.award_coins(tp.owner, 10);
  else perform public.award_coins(me, 2); perform public.award_coins(tp.owner, 2);
  end if;

  return jsonb_build_object('winner',winner,
    'loot',jsonb_build_object('metal',loot_m,'crystal',loot_c,'deuterium',loot_d),
    'attacker_ships',new_ap_ships,
    'attacker_resources',(select resources from public.planets where id=ap.id));
end $$;

grant execute on function public.attack_player(int,int,int,jsonb) to authenticated;

-- ## 4) ADMIN-VERWALTUNG ##
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

-- Admin: eine einzelne Ressource gezielt erhöhen/verringern.
create or replace function public.admin_add_resource(target_username text, kind text, amount bigint)
returns void language plpgsql security definer set search_path = public as $$
declare tid uuid; pid uuid;
begin
  if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
    raise exception 'Keine Admin-Rechte'; end if;
  if kind not in ('metal','crystal','deuterium','gold','titan') then
    raise exception 'Unbekannte Ressource'; end if;
  select id into tid from public.profiles where username = target_username;
  if tid is null then raise exception 'Spieler nicht gefunden'; end if;
  select id into pid from public.planets where owner = tid order by created_at limit 1;
  if pid is null then raise exception 'Spieler hat noch keinen Planeten'; end if;
  update public.planets set resources = jsonb_set(
    coalesce(resources, '{}'::jsonb), array[kind],
    to_jsonb(greatest(0, coalesce((resources->>kind)::numeric, 0) + amount)), true
  ) where id = pid;
end $$;
grant execute on function public.admin_add_resource(text, text, bigint) to authenticated;

-- Globale Spieleinstellungen (z. B. Baukosten an/aus)
create table if not exists public.game_settings (
  key   text primary key,
  value text not null
);
alter table public.game_settings enable row level security;
drop policy if exists gs_select on public.game_settings;
create policy gs_select on public.game_settings for select to anon, authenticated using (true);
insert into public.game_settings(key, value) values ('free_build', 'false') on conflict do nothing;

create or replace function public.admin_set_setting(k text, v text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.game_admins where user_id = auth.uid()) then
    raise exception 'Keine Admin-Rechte'; end if;
  insert into public.game_settings(key, value) values (k, v)
    on conflict (key) do update set value = excluded.value;
end $$;
grant execute on function public.admin_set_setting(text, text) to authenticated;

-- Standardwert für "Bauzeit aus" (sofortiger Bau)
insert into public.game_settings(key, value) values ('instant_build', 'false') on conflict do nothing;

-- ## 5) PVP MIT FLUGZEIT + SPIONAGE ##
-- ============================================================================
--  NEXARION – PvP mit Flugzeit: Auflösung bei Ankunft + Spionage
-- ============================================================================
--  Einspielen: Supabase SQL-Editor → ausführen. Voraussetzung: setup_extras.sql
--  (planets, unit_stats, award_coins) wurde bereits ausgeführt.
--
--  resolve_pvp_attack: löst einen Angriff (mitgeführte Flotte) gegen das Ziel
--  auf – verändert NUR den Ziel-Planeten (server-autoritativ für das Opfer) und
--  liefert die Überlebenden + Beute zurück (der Angreifer verwaltet seine
--  fliegende Flotte clientseitig). spy_player liefert eine Momentaufnahme.
-- ============================================================================

create or replace function public.resolve_pvp_attack(t_g int, t_s int, t_p int, atk_ships jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  ap public.planets%rowtype;
  tp public.planets%rowtype;
  awm numeric; aam numeric; asm numeric; dwm numeric; dam numeric; dsm numeric;
  atk_w numeric; atk_hp numeric; def_w numeric; def_hp numeric;
  lossA numeric; lossD numeric; winner text;
  new_atk jsonb := '{}'::jsonb; new_tp_ships jsonb := '{}'::jsonb; new_tp_def jsonb := '{}'::jsonb;
  loot_m bigint := 0; loot_c bigint := 0; loot_d bigint := 0; cap numeric := 0; freecap numeric;
  rec record; lost int; surviving int;
  R numeric := 3;
begin
  if me is null then raise exception 'Nicht eingeloggt'; end if;
  if atk_ships is null or atk_ships = '{}'::jsonb then raise exception 'Keine Schiffe'; end if;
  select * into tp from public.planets where galaxy=t_g and system=t_s and position=t_p for update;
  if not found then raise exception 'Ziel existiert nicht'; end if;
  if tp.owner = me then raise exception 'Du kannst dich nicht selbst angreifen'; end if;
  select * into ap from public.planets where owner = me order by created_at limit 1; -- nur für Tech

  awm := 1+0.1*coalesce((ap.research->>'weaponsTech')::int,0);
  aam := 1+0.1*coalesce((ap.research->>'armorTech')::int,0);
  asm := 1+0.1*coalesce((ap.research->>'shieldTech')::int,0);
  dwm := 1+0.1*coalesce((tp.research->>'weaponsTech')::int,0);
  dam := 1+0.1*coalesce((tp.research->>'armorTech')::int,0);
  dsm := 1+0.1*coalesce((tp.research->>'shieldTech')::int,0);

  select coalesce(sum(e.value::int*us.weapon),0),
         coalesce(sum(e.value::int*(us.structure*aam+us.shield*asm)),0)
    into atk_w, atk_hp
    from jsonb_each_text(atk_ships) e join public.unit_stats us on us.id=e.key;
  atk_w := atk_w*awm;
  select coalesce(sum(e.value::int*us.weapon),0),
         coalesce(sum(e.value::int*(us.structure*dam+us.shield*dsm)),0)
    into def_w, def_hp
    from jsonb_each_text(tp.ships||tp.defenses) e join public.unit_stats us on us.id=e.key;
  def_w := def_w*dwm;

  lossD := case when def_hp>0 then least(1.0,(atk_w*R)/def_hp) else 0 end;
  lossA := case when atk_hp>0 then least(1.0,(def_w*R)/atk_hp) else 0 end;
  if lossA>=1 and lossD>=1 then winner:='draw';
  elsif lossA>=1 then winner:='defender';
  elsif lossD>=1 then winner:='attacker';
  else winner:='draw'; end if;

  for rec in select key,value from jsonb_each_text(atk_ships) loop
    lost := floor(rec.value::int*lossA);
    new_atk := jsonb_set(new_atk, array[rec.key], to_jsonb(greatest(0, rec.value::int-lost)), true);
  end loop;
  for rec in select key,value from jsonb_each_text(tp.ships) loop
    lost := floor(rec.value::int*lossD);
    new_tp_ships := jsonb_set(new_tp_ships, array[rec.key], to_jsonb(greatest(0, rec.value::int-lost)), true);
  end loop;
  for rec in select key,value from jsonb_each_text(tp.defenses) loop
    lost := floor(rec.value::int*lossD); surviving := rec.value::int-lost;
    new_tp_def := jsonb_set(new_tp_def, array[rec.key], to_jsonb(surviving + floor(lost*0.7)), true);
  end loop;

  if winner='attacker' then
    select coalesce(sum( greatest(0, e.value::int - floor(e.value::int*lossA)) * us.cargo),0)
      into cap from jsonb_each_text(atk_ships) e join public.unit_stats us on us.id=e.key;
    freecap := cap;
    loot_m := least(floor(coalesce((tp.resources->>'metal')::numeric,0)*0.5), freecap); freecap:=freecap-loot_m;
    loot_c := least(floor(coalesce((tp.resources->>'crystal')::numeric,0)*0.5), freecap); freecap:=freecap-loot_c;
    loot_d := least(floor(coalesce((tp.resources->>'deuterium')::numeric,0)*0.5), freecap); freecap:=freecap-loot_d;
  end if;

  update public.planets set ships=new_tp_ships, defenses=new_tp_def,
    resources = jsonb_build_object(
      'metal',    greatest(0, coalesce((tp.resources->>'metal')::numeric,0)-loot_m),
      'crystal',  greatest(0, coalesce((tp.resources->>'crystal')::numeric,0)-loot_c),
      'deuterium',greatest(0, coalesce((tp.resources->>'deuterium')::numeric,0)-loot_d))
  where id=tp.id;

  insert into public.reports(owner,type,payload) values
    (me, 'pvp_attack', jsonb_build_object('target',jsonb_build_array(t_g,t_s,t_p),'winner',winner,
        'loot',jsonb_build_object('metal',loot_m,'crystal',loot_c,'deuterium',loot_d))),
    (tp.owner, 'pvp_defense', jsonb_build_object('from',jsonb_build_array(ap.galaxy,ap.system,ap.position),'winner',winner,
        'loot',jsonb_build_object('metal',loot_m,'crystal',loot_c,'deuterium',loot_d)));

  if winner='attacker' then perform public.award_coins(me, 10);
  elsif winner='defender' then perform public.award_coins(tp.owner, 10);
  else perform public.award_coins(me, 2); perform public.award_coins(tp.owner, 2); end if;

  return jsonb_build_object('winner',winner,'survivors',new_atk,
    'loot',jsonb_build_object('metal',loot_m,'crystal',loot_c,'deuterium',loot_d));
end $$;
grant execute on function public.resolve_pvp_attack(int,int,int,jsonb) to authenticated;

-- Spionage: Momentaufnahme des Ziels; Verteidiger erhält einen Hinweis.
create or replace function public.spy_player(t_g int, t_s int, t_p int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); tp public.planets%rowtype; ap public.planets%rowtype;
begin
  if me is null then raise exception 'Nicht eingeloggt'; end if;
  select * into tp from public.planets where galaxy=t_g and system=t_s and position=t_p;
  if not found then raise exception 'Ziel existiert nicht'; end if;
  select * into ap from public.planets where owner=me order by created_at limit 1;
  insert into public.reports(owner,type,payload) values
    (tp.owner, 'spied', jsonb_build_object('from', jsonb_build_array(ap.galaxy,ap.system,ap.position)));
  return jsonb_build_object('name',tp.name,'coords',jsonb_build_array(t_g,t_s,t_p),
    'resources',tp.resources,'ships',tp.ships,'defenses',tp.defenses);
end $$;
grant execute on function public.spy_player(int,int,int) to authenticated;

-- ## 6) ALLIANZ-CHAT & RANGLISTE ##
-- ============================================================================
--  NEXARION – Allianz-Chat & Allianz-Rangliste
-- ============================================================================
--  Voraussetzung: setup_extras.sql (alliances, alliance_members) ausgeführt.
-- ============================================================================

create table if not exists public.alliance_messages (
  id          uuid primary key default gen_random_uuid(),
  alliance_id uuid not null references public.alliances(id) on delete cascade,
  sender      uuid not null references public.profiles(id) on delete cascade,
  sender_name text not null,
  body        text not null check (char_length(body) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index if not exists alliance_messages_idx on public.alliance_messages(alliance_id, created_at desc);

alter table public.alliance_messages enable row level security;

-- Nur Mitglieder dürfen den Chat ihrer Allianz lesen/schreiben.
drop policy if exists am_select on public.alliance_messages;
create policy am_select on public.alliance_messages for select to authenticated
  using (exists (select 1 from public.alliance_members m
                 where m.alliance_id = alliance_messages.alliance_id and m.user_id = auth.uid()));
drop policy if exists am_insert on public.alliance_messages;
create policy am_insert on public.alliance_messages for insert to authenticated
  with check (sender = auth.uid()
              and exists (select 1 from public.alliance_members m
                          where m.alliance_id = alliance_messages.alliance_id and m.user_id = auth.uid()));

-- Rangliste: Allianzen nach Gesamtpunkten der Mitglieder.
create or replace view public.alliance_ranking as
  select a.id, a.name, a.tag,
         count(m.user_id) as members,
         coalesce(sum(p.points), 0) as points
  from public.alliances a
  left join public.alliance_members m on m.alliance_id = a.id
  left join public.profiles p on p.id = m.user_id
  group by a.id, a.name, a.tag
  order by points desc;
grant select on public.alliance_ranking to authenticated, anon;

