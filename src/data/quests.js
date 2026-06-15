// Quests / Aufträge – feste Ziele, die XP (und teils Ressourcen) bringen.
// progress(game) liefert den aktuellen Fortschritt; ab goal ist die Quest fertig
// und kann einmalig abgeholt werden.

const sum = (obj) => Object.values(obj || {}).reduce((a, b) => a + (Number(b) || 0), 0);

export const QUESTS = [
  // ---- Einstieg
  { id: 'q_metal5', name: 'Erste Mine', icon: '⛏️', goal: 5,
    desc: 'Baue die Metallmine auf Stufe 5.', reward: { xp: 400, metal: 2000 },
    progress: (g) => g.state.buildings.metalMine || 0 },
  { id: 'q_lab', name: 'Wissensdurst', icon: '🔬', goal: 1,
    desc: 'Errichte ein Forschungslabor.', reward: { xp: 500 },
    progress: (g) => g.state.buildings.researchLab || 0 },
  { id: 'q_shipyard', name: 'Werftarbeit', icon: '🏗️', goal: 1,
    desc: 'Baue eine Raumschiffwerft.', reward: { xp: 700 },
    progress: (g) => g.state.buildings.shipyard || 0 },
  { id: 'q_research5', name: 'Technikpionier', icon: '📡', goal: 5,
    desc: 'Erforsche insgesamt 5 Technologie-Stufen.', reward: { xp: 1000, crystal: 3000 },
    progress: (g) => sum(g.state.research) },

  // ---- Aufbau
  { id: 'q_mine10', name: 'Bergbau-Imperium', icon: '⛏️', goal: 30,
    desc: 'Bringe Metall-, Kristall- und Deuteriummine auf zusammen 30 Stufen.', reward: { xp: 2500, metal: 20000 },
    progress: (g) => (g.state.buildings.metalMine || 0) + (g.state.buildings.crystalMine || 0) + (g.state.buildings.deuteriumSynth || 0) },
  { id: 'q_buildings50', name: 'Großbaustelle', icon: '🏙️', goal: 50,
    desc: 'Erreiche 50 Gebäude-Stufen insgesamt.', reward: { xp: 5000 },
    progress: (g) => sum(g.state.buildings) },
  { id: 'q_storage10', name: 'Volle Lager', icon: '📦', goal: 30,
    desc: 'Baue die drei Lager auf zusammen 30 Stufen.', reward: { xp: 4000 },
    progress: (g) => (g.state.buildings.metalStorage || 0) + (g.state.buildings.crystalStorage || 0) + (g.state.buildings.deuteriumTank || 0) },

  // ---- Mitarbeiter
  { id: 'q_officer1', name: 'Erste Anstellung', icon: '👥', goal: 1,
    desc: 'Heuere deinen ersten Mitarbeiter an.', reward: { xp: 1200 },
    progress: (g) => sum(g.state.officers) },
  { id: 'q_officer10', name: 'Führungsstab', icon: '🎖️', goal: 10,
    desc: 'Sammle insgesamt 10 Mitarbeiter-Stufen.', reward: { xp: 6000 },
    progress: (g) => sum(g.state.officers) },

  // ---- Karte / Stadtplanung
  { id: 'q_place5', name: 'Stadtplaner', icon: '🗺️', goal: 5,
    desc: 'Platziere 5 Gebäude auf der Karte.', reward: { xp: 1500, metal: 5000 },
    progress: (g) => Object.keys(g.state.layout || {}).length },
  { id: 'q_place12', name: 'Großbaumeister', icon: '🏗️', goal: 12,
    desc: 'Platziere 12 Gebäude auf der Karte.', reward: { xp: 5000 },
    progress: (g) => Object.keys(g.state.layout || {}).length },
  { id: 'q_types10', name: 'Vielseitig', icon: '🏙️', goal: 10,
    desc: 'Besitze 10 verschiedene Gebäude-Arten.', reward: { xp: 4000 },
    progress: (g) => Object.values(g.state.buildings || {}).filter((v) => v > 0).length },
  { id: 'q_solar12', name: 'Energiewende', icon: '☀️', goal: 12,
    desc: 'Bringe das Solarkraftwerk auf Stufe 12.', reward: { xp: 3000 },
    progress: (g) => g.state.buildings.solarPlant || 0 },
  { id: 'q_research10', name: 'Forscherdrang', icon: '🔭', goal: 10,
    desc: 'Erforsche insgesamt 10 Technologie-Stufen.', reward: { xp: 3000, crystal: 8000 },
    progress: (g) => sum(g.state.research) },

  // ---- Meilensteine (Level)
  { id: 'q_level25', name: 'Aufsteiger', icon: '⭐', goal: 25,
    desc: 'Erreiche Spielerlevel 25.', reward: { xp: 8000 },
    progress: (g) => g.level() },
  { id: 'q_level50', name: 'Veteran', icon: '🌟', goal: 50,
    desc: 'Erreiche Spielerlevel 50.', reward: { xp: 20000 },
    progress: (g) => g.level() },
  { id: 'q_level100', name: 'Legende', icon: '🏆', goal: 100,
    desc: 'Erreiche Spielerlevel 100.', reward: { xp: 60000 },
    progress: (g) => g.level() },
];

export const QUEST_MAP = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
