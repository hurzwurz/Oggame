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
