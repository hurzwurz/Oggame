-- ============================================================================
--  Oggame – Datenbank-Schema (Phase 1: Fundament für Multiplayer)
-- ============================================================================
--  Einspielen: Supabase Dashboard → SQL Editor → dieses Skript einfügen → Run.
--  Idempotent gehalten, kann bei Änderungen erneut ausgeführt werden.
-- ============================================================================

-- ---------------------------------------------------------------- profiles
-- Ein Profil pro eingeloggtem Nutzer (verknüpft mit Supabase Auth).
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text unique not null,
  points      bigint not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- planets
-- Geteilte Galaxie: jeder Planet hat eindeutige Koordinaten.
-- Der vollständige Zustand liegt als JSONB vor (für Phase 1 ausreichend,
-- wird in Phase 2/3 bei Bedarf normalisiert).
create table if not exists public.planets (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references public.profiles(id) on delete cascade,
  name        text not null default 'Heimatplanet',
  galaxy      int  not null,
  system      int  not null,
  position    int  not null,
  resources   jsonb not null default '{"metal":500,"crystal":500,"deuterium":100}'::jsonb,
  buildings   jsonb not null default '{}'::jsonb,
  research    jsonb not null default '{}'::jsonb,
  ships       jsonb not null default '{}'::jsonb,
  defenses    jsonb not null default '{}'::jsonb,
  queues      jsonb not null default '{}'::jsonb,
  last_update timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (galaxy, system, position)
);
create index if not exists planets_owner_idx on public.planets(owner);

-- ---------------------------------------------------------------- fleets
-- Unterwegs befindliche Flotten. Werden in Phase 3 serverseitig aufgelöst.
create table if not exists public.fleets (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references public.profiles(id) on delete cascade,
  origin        uuid references public.planets(id) on delete set null,
  mission       text not null,
  target_galaxy int not null,
  target_system int not null,
  target_pos    int not null,
  ships         jsonb not null default '{}'::jsonb,
  cargo         jsonb not null default '{}'::jsonb,
  phase         text not null default 'outbound',
  depart_at     timestamptz not null default now(),
  arrive_at     timestamptz not null,
  return_at     timestamptz not null,
  processed     boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists fleets_owner_idx on public.fleets(owner);
create index if not exists fleets_arrive_idx on public.fleets(arrive_at) where not processed;

-- ---------------------------------------------------------------- reports
create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  owner       uuid not null references public.profiles(id) on delete cascade,
  type        text not null,
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists reports_owner_idx on public.reports(owner, created_at desc);

-- ============================================================================
--  Row-Level-Security (RLS)
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.planets  enable row level security;
alter table public.fleets   enable row level security;
alter table public.reports  enable row level security;

-- profiles: jeder eingeloggte Nutzer darf Profile lesen (Namen in der Galaxie),
-- aber nur sein eigenes anlegen/ändern.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (auth.uid() = id);

-- planets: NUR der Besitzer darf seine Planeten im Detail lesen/schreiben.
-- Fremde Planeten sieht man nur über die eingeschränkte View unten
-- (bzw. später über Spionage per Edge Function).
drop policy if exists planets_owner_all on public.planets;
create policy planets_owner_all on public.planets
  for all to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

-- fleets / reports: nur eigene.
drop policy if exists fleets_owner_all on public.fleets;
create policy fleets_owner_all on public.fleets
  for all to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);
drop policy if exists reports_owner_all on public.reports;
create policy reports_owner_all on public.reports
  for all to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

-- ============================================================================
--  Öffentliche Galaxie-Ansicht (nur unkritische Felder)
-- ============================================================================
-- Zeigt allen Spielern Koordinaten + Planetenname + Besitzername,
-- aber KEINE Flotten/Verteidigung (dafür gibt es später Spionage).
-- Reguläre Views laufen mit Besitzerrechten und umgehen damit die RLS der
-- Basistabelle – wir geben hier also bewusst nur einen sicheren Ausschnitt frei.
create or replace view public.galaxy_overview as
  select p.galaxy, p.system, p.position, p.name,
         pr.username as owner_name, pr.points
  from public.planets p
  join public.profiles pr on pr.id = p.owner;

grant select on public.galaxy_overview to authenticated, anon;

-- ============================================================================
--  Auto-Anlage des Profils beim Registrieren
-- ============================================================================
-- Legt für jeden neuen Auth-Nutzer automatisch ein Profil an.
-- Der Username kommt aus den Sign-up-Metadaten (data.username) oder fällt
-- auf den E-Mail-Präfix zurück.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
