// Gebäude-Definitionen.
//
// Jedes Gebäude ist datengetrieben: Grundkosten + Kostenfaktor pro Stufe.
// Kosten für die nächste Stufe = baseCost * factor^aktuelleStufe.
//
// Felder:
//   id           eindeutiger Schlüssel (wird im Spielstand verwendet)
//   name         Anzeigename
//   desc         Kurzbeschreibung
//   baseCost     { metal, crystal, deuterium }
//   factor       Kostenmultiplikator pro Stufe
//   energyCost   (optional) Funktion(level) -> Energieverbrauch pro Stunde
//   requirements (optional) { buildings:{id:level}, research:{id:level} }

export const BUILDINGS = [
  {
    id: 'metalMine',
    name: 'Metallmine',
    desc: 'Fördert Metall – den Grundbaustoff deines Imperiums.',
    baseCost: { metal: 60, crystal: 15, deuterium: 0 },
    factor: 1.5,
    energyCost: (l) => Math.floor(10 * l * Math.pow(1.1, l)),
  },
  {
    id: 'crystalMine',
    name: 'Kristallmine',
    desc: 'Fördert Kristall, benötigt für Elektronik und fortgeschrittene Technik.',
    baseCost: { metal: 48, crystal: 24, deuterium: 0 },
    factor: 1.6,
    energyCost: (l) => Math.floor(10 * l * Math.pow(1.1, l)),
  },
  {
    id: 'deuteriumSynth',
    name: 'Deuteriumsynthetisierer',
    desc: 'Gewinnt Deuterium – Treibstoff für Flotten und Fusion.',
    baseCost: { metal: 225, crystal: 75, deuterium: 0 },
    factor: 1.5,
    energyCost: (l) => Math.floor(20 * l * Math.pow(1.1, l)),
  },
  {
    id: 'solarPlant',
    name: 'Solarkraftwerk',
    desc: 'Erzeugt Energie aus Sonnenlicht und versorgt deine Minen.',
    baseCost: { metal: 75, crystal: 30, deuterium: 0 },
    factor: 1.5,
  },
  {
    id: 'fusionPlant',
    name: 'Fusionskraftwerk',
    desc: 'Verbrennt Deuterium für große Mengen Energie.',
    baseCost: { metal: 900, crystal: 360, deuterium: 180 },
    factor: 1.8,
    requirements: { buildings: { deuteriumSynth: 5 }, research: { energyTech: 3 } },
  },
  {
    id: 'metalStorage',
    name: 'Metallspeicher',
    desc: 'Erhöht die Lagerkapazität für Metall.',
    baseCost: { metal: 1000, crystal: 0, deuterium: 0 },
    factor: 2,
  },
  {
    id: 'crystalStorage',
    name: 'Kristallspeicher',
    desc: 'Erhöht die Lagerkapazität für Kristall.',
    baseCost: { metal: 1000, crystal: 500, deuterium: 0 },
    factor: 2,
  },
  {
    id: 'deuteriumTank',
    name: 'Deuteriumtank',
    desc: 'Erhöht die Lagerkapazität für Deuterium.',
    baseCost: { metal: 1000, crystal: 1000, deuterium: 0 },
    factor: 2,
  },
  {
    id: 'roboticsFactory',
    name: 'Roboterfabrik',
    desc: 'Beschleunigt den Bau von Gebäuden und Verteidigung.',
    baseCost: { metal: 400, crystal: 120, deuterium: 200 },
    factor: 2,
  },
  {
    id: 'naniteFactory',
    name: 'Nanitenfabrik',
    desc: 'Halbiert die Bauzeit pro Stufe – das Rückgrat einer Großmacht.',
    baseCost: { metal: 1000000, crystal: 500000, deuterium: 100000 },
    factor: 2,
    requirements: { buildings: { roboticsFactory: 10 }, research: { computerTech: 10 } },
  },
  {
    id: 'shipyard',
    name: 'Raumschiffwerft',
    desc: 'Baut Schiffe und Verteidigungsanlagen.',
    baseCost: { metal: 400, crystal: 200, deuterium: 100 },
    factor: 2,
    requirements: { buildings: { roboticsFactory: 2 } },
  },
  {
    id: 'researchLab',
    name: 'Forschungslabor',
    desc: 'Ermöglicht und beschleunigt die Erforschung neuer Technologien.',
    baseCost: { metal: 200, crystal: 400, deuterium: 200 },
    factor: 2,
  },
  {
    id: 'allianceDepot',
    name: 'Allianzdepot',
    desc: 'Versorgt befreundete Flotten im Orbit mit Treibstoff.',
    baseCost: { metal: 20000, crystal: 40000, deuterium: 0 },
    factor: 2,
  },
  {
    id: 'terraformer',
    name: 'Terraformer',
    desc: 'Schafft zusätzliche Felder auf dem Planeten.',
    baseCost: { metal: 0, crystal: 50000, deuterium: 100000 },
    factor: 2,
    energyCost: (l) => Math.floor(1000 * l),
    requirements: { buildings: { naniteFactory: 1 }, research: { energyTech: 12 } },
  },
];

export const BUILDING_MAP = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));
