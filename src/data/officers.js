// Mitarbeiter / Offiziere – anheuerbare Helfer, die das Imperium verbessern.
// Bezahlt werden sie mit Coins (aus Kämpfen). Jede Stufe verstärkt den Effekt.
//
//   effect:  'queue'      -> +1 Bau-Warteschlangenplatz pro Stufe
//            'storage'    -> +Lagerkapazität (%) pro Stufe
//            'production' -> +Rohstoffproduktion (%) pro Stufe
//            'mining'     -> +Metall & Kristall (%) pro Stufe
//            'speed'      -> -Bauzeit (%) pro Stufe
//   per:     Stärke des Effekts pro Stufe (Prozent bzw. Slots)
//   max:     maximale Stufe
//   baseCost/factor: Coin-Kosten der nächsten Stufe = baseCost * factor^Stufe

export const OFFICERS = [
  { id: 'buildMaster',   name: 'Bauleiter',     icon: '👷', effect: 'queue',      per: 1,    max: 10, baseCost: 300, factor: 1.7,
    desc: '+1 Platz in der Bau-Warteschlange pro Stufe.' },
  { id: 'quartermaster', name: 'Lagermeister',  icon: '📦', effect: 'storage',    per: 0.12, max: 10, baseCost: 250, factor: 1.6,
    desc: '+12 % Lagerkapazität pro Stufe.' },
  { id: 'engineer',      name: 'Chefingenieur', icon: '🔧', effect: 'production', per: 0.06, max: 10, baseCost: 400, factor: 1.8,
    desc: '+6 % Gesamtproduktion pro Stufe.' },
  { id: 'geologist',     name: 'Geologe',       icon: '⛏️', effect: 'mining',     per: 0.08, max: 10, baseCost: 350, factor: 1.7,
    desc: '+8 % Metall & Kristall pro Stufe.' },
  { id: 'commander',     name: 'Kommandant',    icon: '🎖️', effect: 'speed',      per: 0.04, max: 10, baseCost: 500, factor: 1.9,
    desc: '-4 % Bauzeit pro Stufe.' },
];

export const OFFICER_MAP = Object.fromEntries(OFFICERS.map((o) => [o.id, o]));

/** Coin-Kosten, um den Mitarbeiter von `level` auf `level+1` zu heben. */
export function officerCost(def, level) {
  return Math.floor(def.baseCost * Math.pow(def.factor, level));
}
