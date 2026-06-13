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

  return jsonb_build_object('winner',winner,
    'loot',jsonb_build_object('metal',loot_m,'crystal',loot_c,'deuterium',loot_d),
    'attacker_ships',new_ap_ships,
    'attacker_resources',(select resources from public.planets where id=ap.id));
end $$;

grant execute on function public.attack_player(int,int,int,jsonb) to authenticated;
