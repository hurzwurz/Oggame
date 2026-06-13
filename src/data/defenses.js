// Verteidigungs-Definitionen.
//
// Verteidigungsanlagen sind stationär (keine Geschwindigkeit/Fracht) und werden
// wie Schiffe in der Werft gebaut. Feste Kosten pro Stück.

export const DEFENSES = [
  {
    id: 'rocketLauncher', name: 'Raketenwerfer',
    desc: 'Billige Grundverteidigung in großer Stückzahl.',
    cost: { metal: 2000, crystal: 0, deuterium: 0 },
    stats: { structure: 2000, shield: 20, weapon: 80 },
    requirements: { buildings: { shipyard: 1 } },
  },
  {
    id: 'lightLaser', name: 'Leichtes Lasergeschütz',
    desc: 'Günstige Laserverteidigung mit Schild.',
    cost: { metal: 1500, crystal: 500, deuterium: 0 },
    stats: { structure: 2000, shield: 25, weapon: 100 },
    requirements: { buildings: { shipyard: 2 }, research: { laserTech: 3 } },
  },
  {
    id: 'heavyLaser', name: 'Schweres Lasergeschütz',
    desc: 'Stärkere Laserverteidigung gegen mittlere Schiffe.',
    cost: { metal: 6000, crystal: 2000, deuterium: 0 },
    stats: { structure: 8000, shield: 100, weapon: 250 },
    requirements: { buildings: { shipyard: 4 }, research: { laserTech: 6, energyTech: 3 } },
  },
  {
    id: 'gaussCannon', name: 'Gaußkanone',
    desc: 'Beschleunigt Projektile auf enorme Geschwindigkeit.',
    cost: { metal: 20000, crystal: 15000, deuterium: 2000 },
    stats: { structure: 35000, shield: 200, weapon: 1100 },
    requirements: { buildings: { shipyard: 6 }, research: { weaponsTech: 3, energyTech: 6, shieldTech: 1 } },
  },
  {
    id: 'ionCannon', name: 'Ionengeschütz',
    desc: 'Starke Schilde; schwächt feindliche Energieschirme.',
    cost: { metal: 5000, crystal: 3000, deuterium: 0 },
    stats: { structure: 8000, shield: 500, weapon: 150 },
    requirements: { buildings: { shipyard: 4 }, research: { ionTech: 4 } },
  },
  {
    id: 'plasmaTurret', name: 'Plasmawerfer',
    desc: 'Verheerende Bodenverteidigung gegen Großkampfschiffe.',
    cost: { metal: 50000, crystal: 50000, deuterium: 30000 },
    stats: { structure: 100000, shield: 300, weapon: 3000 },
    requirements: { buildings: { shipyard: 8 }, research: { plasmaTech: 7 } },
  },
  {
    id: 'teslaTower', name: 'Tesla-Turm',
    desc: 'Kettenblitze treffen mehrere kleine Ziele zugleich.',
    cost: { metal: 30000, crystal: 25000, deuterium: 8000 },
    stats: { structure: 45000, shield: 400, weapon: 1600 },
    requirements: { buildings: { shipyard: 7 }, research: { energyTech: 8, ionTech: 6 } },
  },
  {
    id: 'railgun', name: 'Railgun-Batterie',
    desc: 'Elektromagnetische Schienenkanone mit hoher Durchschlagskraft.',
    cost: { metal: 40000, crystal: 20000, deuterium: 5000 },
    stats: { structure: 60000, shield: 250, weapon: 2200 },
    requirements: { buildings: { shipyard: 8 }, research: { weaponsTech: 8, energyTech: 7 } },
  },
  {
    id: 'flakCannon', name: 'Flak-Geschütz',
    desc: 'Spezialisiert auf Jäger- und Bomberabwehr.',
    cost: { metal: 8000, crystal: 6000, deuterium: 1000 },
    stats: { structure: 12000, shield: 120, weapon: 450 },
    requirements: { buildings: { shipyard: 5 }, research: { laserTech: 8, weaponsTech: 4 } },
  },
  {
    id: 'smallShieldDome', name: 'Kleine Schildkuppel',
    desc: 'Planetarer Schild – nur einmal baubar.',
    cost: { metal: 10000, crystal: 10000, deuterium: 0 },
    stats: { structure: 20000, shield: 2000, weapon: 1 },
    max: 1,
    requirements: { buildings: { shipyard: 1 }, research: { shieldTech: 2 } },
  },
  {
    id: 'largeShieldDome', name: 'Große Schildkuppel',
    desc: 'Mächtiger planetarer Schild – nur einmal baubar.',
    cost: { metal: 50000, crystal: 50000, deuterium: 0 },
    stats: { structure: 100000, shield: 10000, weapon: 1 },
    max: 1,
    requirements: { buildings: { shipyard: 6 }, research: { shieldTech: 6 } },
  },
  {
    id: 'interplanetaryMissile', name: 'Interplanetarrakete',
    desc: 'Zerstört gegnerische Verteidigung aus der Ferne.',
    cost: { metal: 12500, crystal: 2500, deuterium: 10000 },
    stats: { structure: 15000, shield: 1, weapon: 12000 },
    requirements: { buildings: { shipyard: 1 }, research: { impulseDrive: 1 } },
  },
];

export const DEFENSE_MAP = Object.fromEntries(DEFENSES.map((d) => [d.id, d]));
