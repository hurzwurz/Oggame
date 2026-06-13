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
