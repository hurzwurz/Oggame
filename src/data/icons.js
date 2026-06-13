// Zentrale Icon-Tabelle (Emoji) für alle Spielobjekte.
// Auf Mobilgeräten werden Emoji als farbige Grafiken dargestellt -> "Bilder überall".
// Real gezeichnete Artworks können später hier durch <img>/SVG ersetzt werden.

export const ICONS = {
  // Ressourcen
  metal: '⛏️', crystal: '💎', deuterium: '🛢️', energy: '⚡',

  // Gebäude
  metalMine: '⛏️', crystalMine: '💎', deuteriumSynth: '⚗️', solarPlant: '☀️',
  fusionPlant: '⚛️', metalStorage: '📦', crystalStorage: '🔷', deuteriumTank: '🛢️',
  roboticsFactory: '🤖', naniteFactory: '🦾', shipyard: '🏗️', researchLab: '🔬',
  allianceDepot: '🏛️', terraformer: '🌍',

  // Forschung
  energyTech: '⚡', laserTech: '🔴', ionTech: '🌀', plasmaTech: '🟣',
  hyperspaceTech: '🌌', combustionDrive: '🔥', impulseDrive: '💨', hyperspaceDrive: '🌠',
  espionageTech: '🕵️', computerTech: '💻', astrophysics: '🔭', researchNetwork: '📡',
  graviton: '🕳️', weaponsTech: '⚔️', shieldTech: '🛡️', armorTech: '🪨',

  // Schiffe
  smallCargo: '🛻', largeCargo: '🚚', hugeCargo: '🚛', tanker: '⛽', colonyShip: '🏙️',
  recycler: '♻️', espionageProbe: '📡', solarSatellite: '🛰️', crawler: '🚜', pathfinder: '🧭',
  lightFighter: '✈️', heavyFighter: '🛩️', interceptor: '🛫', corvette: '🛸', cruiser: '🚀',
  frigate: '🚀', battleship: '🛳️', battlecruiser: '🚀', heavyCruiser: '🚢', bomber: '💣',
  destroyer: '💥', plasmaCruiser: '🟣', dreadnought: '🔱', carrier: '🛳️', titan: '🗿',
  reaper: '☠️', leviathan: '🐉', deathstar: '🌑', stealthShip: '🥷', gunship: '🔫', ionFrigate: '🌀',

  // Verteidigung
  rocketLauncher: '🚀', lightLaser: '🔴', heavyLaser: '🔆', gaussCannon: '🔩', ionCannon: '🌀',
  plasmaTurret: '🟣', teslaTower: '⚡', railgun: '🔫', flakCannon: '💢',
  smallShieldDome: '🟦', largeShieldDome: '🔷', interplanetaryMissile: '🚀',
};

// Fallback je Kategorie/Schiffsklasse
const FALLBACK = {
  building: '🏗️', research: '🔬', defense: '🛡️',
  zivil: '🛰️', jaeger: '✈️', grosskampf: '🚀', spezial: '🛸',
};

export function getIcon(id, fallbackKey) {
  return ICONS[id] || FALLBACK[fallbackKey] || '🔹';
}
