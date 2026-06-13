-- ============================================================================
--  Oggame – Datenbank-Schema (Phase 1)
-- ============================================================================
--  Einspielen: Supabase Dashboard → SQL Editor → komplett einfügen → Run.
--  Idempotent: kann gefahrlos erneut ausgeführt werden.
--  Hinweis: Das Profil wird vom Spiel selbst beim ersten Login angelegt
--  (kein Trigger auf auth.users nötig – das vermeidet Rechteprobleme).
-- ============================================================================

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  username    text unique not null,
  points      bigint not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- planets
-- Geteilte Galaxie: jeder Planet hat eindeutige Koordinaten.
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

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (auth.uid() = id);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (auth.uid() = id);

drop policy if exists planets_owner_all on public.planets;
create policy planets_owner_all on public.planets
  for all to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists fleets_owner_all on public.fleets;
create policy fleets_owner_all on public.fleets
  for all to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

drop policy if exists reports_owner_all on public.reports;
create policy reports_owner_all on public.reports
  for all to authenticated using (auth.uid() = owner) with check (auth.uid() = owner);

-- ============================================================================
--  Öffentliche Galaxie-Ansicht (nur unkritische Felder)
-- ============================================================================
-- Zeigt allen Spielern Koordinaten + Planetenname + Besitzername + Punkte,
-- aber KEINE Flotten/Verteidigung (dafür gibt es später Spionage).
create or replace view public.galaxy_overview as
  select p.galaxy, p.system, p.position, p.name,
         pr.username as owner_name, pr.points
  from public.planets p
  join public.profiles pr on pr.id = p.owner;

grant select on public.galaxy_overview to authenticated, anon;

-- ============================================================================
--  Mini-Spiel "Drück den Pazze" – gemeinsame Top-10-Rangliste
-- ============================================================================
--  Öffentlich (auch ohne Login): jeder darf seinen Score eintragen und die
--  Liste lesen. Eintragen ist durch Längen-/Wertgrenzen leicht abgesichert.
create table if not exists public.kopfjagd_scores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 24),
  score       int  not null check (score >= 0 and score <= 100000),
  acc         int  check (acc >= 0 and acc <= 100),
  created_at  timestamptz not null default now()
);
create index if not exists kopfjagd_scores_score_idx
  on public.kopfjagd_scores (score desc, created_at asc);

alter table public.kopfjagd_scores enable row level security;

drop policy if exists kopfjagd_scores_select on public.kopfjagd_scores;
create policy kopfjagd_scores_select on public.kopfjagd_scores
  for select to anon, authenticated using (true);

drop policy if exists kopfjagd_scores_insert on public.kopfjagd_scores;
create policy kopfjagd_scores_insert on public.kopfjagd_scores
  for insert to anon, authenticated
  with check (char_length(name) between 1 and 24 and score >= 0 and score <= 100000);

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
