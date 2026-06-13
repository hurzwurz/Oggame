// Schiffs-Definitionen — bewusst umfangreich.
//
// Schiffe haben feste Kosten (skalieren nicht pro Stück) und Kampfwerte.
// Neue Schiffe hinzufügen = einfach einen Eintrag ergänzen.
//
// Felder:
//   id           eindeutiger Schlüssel
//   name         Anzeigename
//   class        'zivil' | 'jaeger' | 'grosskampf' | 'spezial'
//   desc         Kurzbeschreibung
//   cost         { metal, crystal, deuterium }
//   stats:
//     structure  Hüllenpunkte (skaliert mit Raumschiffpanzerung)
//     shield     Schildpunkte  (skaliert mit Schildtechnik)
//     weapon     Angriffswert  (skaliert mit Waffentechnik)
//     cargo      Frachtkapazität
//     speed      Grundgeschwindigkeit
//     fuel       Treibstoffverbrauch (Deuterium) pro Distanz
//     drive      'combustion' | 'impulse' | 'hyperspace'
//   requirements { buildings:{}, research:{} }  (shipyard wird implizit benötigt)

export const SHIPS = [
  // ---------------------------------------------------------------- ZIVIL
  {
    id: 'smallCargo', name: 'Kleiner Transporter', class: 'zivil',
    desc: 'Wendiger Frachter für kurze Versorgungsflüge.',
    cost: { metal: 2000, crystal: 2000, deuterium: 0 },
    stats: { structure: 4000, shield: 10, weapon: 5, cargo: 5000, speed: 5000, fuel: 10, drive: 'combustion' },
    requirements: { buildings: { shipyard: 2 }, research: { combustionDrive: 2 } },
  },
  {
    id: 'largeCargo', name: 'Großer Transporter', class: 'zivil',
    desc: 'Arbeitspferd des Imperiums mit großem Laderaum.',
    cost: { metal: 6000, crystal: 6000, deuterium: 0 },
    stats: { structure: 12000, shield: 25, weapon: 5, cargo: 25000, speed: 7500, fuel: 50, drive: 'combustion' },
    requirements: { buildings: { shipyard: 4 }, research: { combustionDrive: 6 } },
  },
  {
    id: 'hugeCargo', name: 'Riesentransporter', class: 'zivil',
    desc: 'Gewaltiger Massengutfrachter für interplanetare Logistik.',
    cost: { metal: 30000, crystal: 25000, deuterium: 0 },
    stats: { structure: 70000, shield: 80, weapon: 10, cargo: 140000, speed: 6000, fuel: 240, drive: 'impulse' },
    requirements: { buildings: { shipyard: 7 }, research: { impulseDrive: 6, hyperspaceTech: 2 } },
  },
  {
    id: 'tanker', name: 'Deuteriumtanker', class: 'zivil',
    desc: 'Spezialfrachter für Treibstoff; betankt Flotten unterwegs.',
    cost: { metal: 18000, crystal: 9000, deuterium: 6000 },
    stats: { structure: 50000, shield: 60, weapon: 5, cargo: 90000, speed: 8000, fuel: 120, drive: 'impulse' },
    requirements: { buildings: { shipyard: 6 }, research: { impulseDrive: 5 } },
  },
  {
    id: 'colonyShip', name: 'Kolonieschiff', class: 'zivil',
    desc: 'Gründet neue Kolonien auf fernen Planeten.',
    cost: { metal: 10000, crystal: 20000, deuterium: 10000 },
    stats: { structure: 30000, shield: 100, weapon: 50, cargo: 7500, speed: 2500, fuel: 1000, drive: 'impulse' },
    requirements: { buildings: { shipyard: 4 }, research: { impulseDrive: 3 } },
  },
  {
    id: 'recycler', name: 'Recycler', class: 'zivil',
    desc: 'Sammelt Trümmerfelder nach Schlachten ein.',
    cost: { metal: 10000, crystal: 6000, deuterium: 2000 },
    stats: { structure: 16000, shield: 10, weapon: 1, cargo: 20000, speed: 2000, fuel: 300, drive: 'combustion' },
    requirements: { buildings: { shipyard: 4 }, research: { combustionDrive: 6, shieldTech: 2 } },
  },
  {
    id: 'espionageProbe', name: 'Spionagesonde', class: 'zivil',
    desc: 'Winziges, blitzschnelles Aufklärungsschiff.',
    cost: { metal: 0, crystal: 1000, deuterium: 0 },
    stats: { structure: 1000, shield: 0, weapon: 0, cargo: 5, speed: 100000000, fuel: 1, drive: 'combustion' },
    requirements: { buildings: { shipyard: 3 }, research: { combustionDrive: 3, espionageTech: 2 } },
  },
  {
    id: 'solarSatellite', name: 'Solarsatellit', class: 'zivil',
    desc: 'Stationäre Energiequelle im Orbit – wehrlos.',
    cost: { metal: 0, crystal: 2000, deuterium: 500 },
    stats: { structure: 2000, shield: 1, weapon: 1, cargo: 0, speed: 0, fuel: 0, drive: 'combustion' },
    requirements: { buildings: { shipyard: 1 } },
  },
  {
    id: 'crawler', name: 'Schürfer', class: 'zivil',
    desc: 'Bodengebundene Drohne, die die Minenproduktion steigert.',
    cost: { metal: 2000, crystal: 2000, deuterium: 1000 },
    stats: { structure: 4000, shield: 1, weapon: 1, cargo: 0, speed: 0, fuel: 0, drive: 'combustion' },
    requirements: { buildings: { shipyard: 5 }, research: { combustionDrive: 4, laserTech: 4, armorTech: 4 } },
  },
  {
    id: 'pathfinder', name: 'Pfadfinder', class: 'zivil',
    desc: 'Expeditions- und Recyclingschiff mit Forschungsmodul.',
    cost: { metal: 8000, crystal: 15000, deuterium: 8000 },
    stats: { structure: 23000, shield: 100, weapon: 200, cargo: 10000, speed: 12000, fuel: 300, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 5 }, research: { hyperspaceDrive: 2, shieldTech: 4 } },
  },

  // --------------------------------------------------------------- JÄGER
  {
    id: 'lightFighter', name: 'Leichter Jäger', class: 'jaeger',
    desc: 'Billiger, schneller Standardjäger – stark in der Masse.',
    cost: { metal: 3000, crystal: 1000, deuterium: 0 },
    stats: { structure: 4000, shield: 10, weapon: 50, cargo: 50, speed: 12500, fuel: 20, drive: 'combustion' },
    requirements: { buildings: { shipyard: 1 }, research: { combustionDrive: 1 } },
  },
  {
    id: 'heavyFighter', name: 'Schwerer Jäger', class: 'jaeger',
    desc: 'Robusterer Jäger mit besserer Bewaffnung.',
    cost: { metal: 6000, crystal: 4000, deuterium: 0 },
    stats: { structure: 10000, shield: 25, weapon: 150, cargo: 100, speed: 10000, fuel: 75, drive: 'impulse' },
    requirements: { buildings: { shipyard: 3 }, research: { armorTech: 2, impulseDrive: 2 } },
  },
  {
    id: 'interceptor', name: 'Abfangjäger', class: 'jaeger',
    desc: 'Hochgeschwindigkeitsjäger zum Abfangen feindlicher Flotten.',
    cost: { metal: 8000, crystal: 6000, deuterium: 1000 },
    stats: { structure: 13000, shield: 40, weapon: 220, cargo: 120, speed: 16000, fuel: 90, drive: 'impulse' },
    requirements: { buildings: { shipyard: 5 }, research: { impulseDrive: 5, laserTech: 6 } },
  },
  {
    id: 'corvette', name: 'Korvette', class: 'jaeger',
    desc: 'Leichtes Mehrzweck-Kriegsschiff mit solider Panzerung.',
    cost: { metal: 12000, crystal: 7000, deuterium: 2000 },
    stats: { structure: 22000, shield: 60, weapon: 320, cargo: 400, speed: 11000, fuel: 130, drive: 'impulse' },
    requirements: { buildings: { shipyard: 5 }, research: { impulseDrive: 4, ionTech: 2 } },
  },
  {
    id: 'cruiser', name: 'Kreuzer', class: 'jaeger',
    desc: 'Schnelles Kriegsschiff, hervorragend gegen Jägerschwärme.',
    cost: { metal: 20000, crystal: 7000, deuterium: 2000 },
    stats: { structure: 27000, shield: 50, weapon: 400, cargo: 800, speed: 15000, fuel: 300, drive: 'impulse' },
    requirements: { buildings: { shipyard: 5 }, research: { impulseDrive: 4, ionTech: 2 } },
  },

  // ---------------------------------------------------------- GROSSKAMPF
  {
    id: 'frigate', name: 'Fregatte', class: 'grosskampf',
    desc: 'Vielseitiges Linienschiff mit ausgewogenen Werten.',
    cost: { metal: 30000, crystal: 12000, deuterium: 4000 },
    stats: { structure: 45000, shield: 120, weapon: 700, cargo: 1200, speed: 12000, fuel: 400, drive: 'impulse' },
    requirements: { buildings: { shipyard: 6 }, research: { impulseDrive: 6, ionTech: 4, shieldTech: 4 } },
  },
  {
    id: 'battleship', name: 'Schlachtschiff', class: 'grosskampf',
    desc: 'Schwer bewaffnetes Großkampfschiff, Rückgrat jeder Flotte.',
    cost: { metal: 45000, crystal: 15000, deuterium: 0 },
    stats: { structure: 60000, shield: 200, weapon: 1000, cargo: 1500, speed: 10000, fuel: 500, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 7 }, research: { hyperspaceDrive: 4 } },
  },
  {
    id: 'battlecruiser', name: 'Schlachtkreuzer', class: 'grosskampf',
    desc: 'Effizientes Großkampfschiff gegen mittelschwere Flotten.',
    cost: { metal: 30000, crystal: 40000, deuterium: 15000 },
    stats: { structure: 70000, shield: 400, weapon: 700, cargo: 750, speed: 10000, fuel: 250, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 8 }, research: { hyperspaceDrive: 5, hyperspaceTech: 5, laserTech: 12 } },
  },
  {
    id: 'heavyCruiser', name: 'Schwerer Kreuzer', class: 'grosskampf',
    desc: 'Dick gepanzerter Kreuzer mit Ionengeschützen.',
    cost: { metal: 38000, crystal: 22000, deuterium: 8000 },
    stats: { structure: 75000, shield: 350, weapon: 900, cargo: 1500, speed: 9000, fuel: 450, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 8 }, research: { hyperspaceDrive: 4, ionTech: 6, armorTech: 8 } },
  },
  {
    id: 'bomber', name: 'Bomber', class: 'grosskampf',
    desc: 'Spezialist zum Niederwalzen von Verteidigungsanlagen.',
    cost: { metal: 50000, crystal: 25000, deuterium: 15000 },
    stats: { structure: 75000, shield: 500, weapon: 1000, cargo: 500, speed: 4000, fuel: 1000, drive: 'impulse' },
    requirements: { buildings: { shipyard: 8 }, research: { impulseDrive: 6, plasmaTech: 5 } },
  },
  {
    id: 'destroyer', name: 'Zerstörer', class: 'grosskampf',
    desc: 'Mächtiges Kriegsschiff – Königin des Schlachtfelds.',
    cost: { metal: 60000, crystal: 50000, deuterium: 15000 },
    stats: { structure: 110000, shield: 500, weapon: 2000, cargo: 2000, speed: 5000, fuel: 1000, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 9 }, research: { hyperspaceDrive: 6, hyperspaceTech: 5, plasmaTech: 5 } },
  },
  {
    id: 'plasmaCruiser', name: 'Plasmakreuzer', class: 'grosskampf',
    desc: 'Trägt verheerende Plasmawerfer; teuer, aber brachial.',
    cost: { metal: 80000, crystal: 60000, deuterium: 20000 },
    stats: { structure: 130000, shield: 700, weapon: 2600, cargo: 1800, speed: 6000, fuel: 900, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 10 }, research: { hyperspaceDrive: 7, plasmaTech: 8 } },
  },
  {
    id: 'dreadnought', name: 'Dreadnought', class: 'grosskampf',
    desc: 'Schwerstes konventionelles Linienschiff mit enormer Feuerkraft.',
    cost: { metal: 120000, crystal: 90000, deuterium: 30000 },
    stats: { structure: 210000, shield: 900, weapon: 3500, cargo: 2500, speed: 5500, fuel: 1200, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 11 }, research: { hyperspaceDrive: 8, plasmaTech: 9, armorTech: 12 } },
  },
  {
    id: 'carrier', name: 'Träger', class: 'grosskampf',
    desc: 'Mobile Basis; verstärkt begleitende Jäger im Kampf.',
    cost: { metal: 100000, crystal: 70000, deuterium: 40000 },
    stats: { structure: 230000, shield: 800, weapon: 1200, cargo: 30000, speed: 4500, fuel: 1500, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 11 }, research: { hyperspaceDrive: 7, shieldTech: 10, computerTech: 8 } },
  },
  {
    id: 'titan', name: 'Titan', class: 'grosskampf',
    desc: 'Supersschwerer Schlachtkoloss; nur Imperien der Spitzenklasse.',
    cost: { metal: 350000, crystal: 250000, deuterium: 100000 },
    stats: { structure: 600000, shield: 2000, weapon: 7000, cargo: 8000, speed: 4000, fuel: 2500, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 12 }, research: { hyperspaceDrive: 10, plasmaTech: 12, armorTech: 15 } },
  },
  {
    id: 'reaper', name: 'Schnitter', class: 'grosskampf',
    desc: 'Sammelt Trümmer noch während der Schlacht ein.',
    cost: { metal: 85000, crystal: 55000, deuterium: 20000 },
    stats: { structure: 140000, shield: 700, weapon: 2800, cargo: 10000, speed: 7000, fuel: 1100, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 10 }, research: { hyperspaceDrive: 8, hyperspaceTech: 6, shieldTech: 6 } },
  },
  {
    id: 'leviathan', name: 'Leviathan', class: 'grosskampf',
    desc: 'Lebendig wirkendes Biotech-Schiff mit regenerierender Hülle.',
    cost: { metal: 500000, crystal: 400000, deuterium: 200000 },
    stats: { structure: 900000, shield: 3500, weapon: 9000, cargo: 12000, speed: 4500, fuel: 3000, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 12 }, research: { hyperspaceDrive: 12, plasmaTech: 14, shieldTech: 14 } },
  },
  {
    id: 'deathstar', name: 'Todesstern', class: 'grosskampf',
    desc: 'Mobile Kampfstation von der Größe eines Mondes.',
    cost: { metal: 5000000, crystal: 4000000, deuterium: 1000000 },
    stats: { structure: 9000000, shield: 50000, weapon: 200000, cargo: 1000000, speed: 100, fuel: 1, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 12 }, research: { hyperspaceDrive: 7, hyperspaceTech: 6, graviton: 1 } },
  },

  // --------------------------------------------------------------- SPEZIAL
  {
    id: 'stealthShip', name: 'Phantom', class: 'spezial',
    desc: 'Tarnkappenschiff – schwer aufzuklären, ideal für Überraschungsangriffe.',
    cost: { metal: 40000, crystal: 35000, deuterium: 15000 },
    stats: { structure: 55000, shield: 300, weapon: 1500, cargo: 2000, speed: 18000, fuel: 600, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 9 }, research: { hyperspaceDrive: 6, ionTech: 8, espionageTech: 8 } },
  },
  {
    id: 'gunship', name: 'Kanonenboot', class: 'spezial',
    desc: 'Kleines Schiff mit unverhältnismäßig schwerer Bewaffnung.',
    cost: { metal: 25000, crystal: 18000, deuterium: 6000 },
    stats: { structure: 35000, shield: 200, weapon: 1400, cargo: 600, speed: 9000, fuel: 350, drive: 'impulse' },
    requirements: { buildings: { shipyard: 7 }, research: { impulseDrive: 6, plasmaTech: 3 } },
  },
  {
    id: 'ionFrigate', name: 'Ionenfregatte', class: 'spezial',
    desc: 'Ionengeschütze legen feindliche Schilde lahm.',
    cost: { metal: 45000, crystal: 30000, deuterium: 10000 },
    stats: { structure: 65000, shield: 600, weapon: 1100, cargo: 1500, speed: 11000, fuel: 500, drive: 'hyperspace' },
    requirements: { buildings: { shipyard: 9 }, research: { hyperspaceDrive: 5, ionTech: 8, shieldTech: 8 } },
  },
];

export const SHIP_MAP = Object.fromEntries(SHIPS.map((s) => [s.id, s]));

export const SHIP_CLASSES = {
  zivil: 'Zivilschiffe',
  jaeger: 'Jäger & leichte Schiffe',
  grosskampf: 'Großkampfschiffe',
  spezial: 'Spezialschiffe',
};
