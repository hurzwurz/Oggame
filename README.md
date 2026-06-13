# 🚀 Oggame

Ein **OGame-inspiriertes Weltraum-Strategiespiel** für den Browser – mit einer
bewusst großen Schiffsdatenbank und vollständig datengetriebenem Spielinhalt.

Aktueller Stand: spielbares **Single-Player-MVP** mit Ressourcenwirtschaft,
Gebäuden, Forschung, Schiffsbau, Verteidigung, einer **NPC-Galaxie mit
Flottenmissionen** und einem **Kampfsimulator**. Läuft komplett im Browser,
**ohne externe Abhängigkeiten**, Spielstand wird lokal gespeichert.

## Features

- **Ressourcenwirtschaft** mit Tick-System: Metall, Kristall, Deuterium und
  Energie produzieren sich in Echtzeit – auch offline (Fortschritt wird beim
  Laden nachgeholt).
- **Gebäude** (15): Minen, Kraftwerke, Speicher, Werft, Labor, Roboter-/
  Nanitenfabrik, Terraformer u. a.
- **Forschung** (16): Antriebe, Waffen-/Schild-/Panzerungstechnik, Hyperraum,
  Plasma, Astrophysik, Graviton …
- **Schiffe** (33!): von Spionagesonde und Transportern über Jäger und
  Großkampfschiffe bis Todesstern, Titan und Leviathan – in vier Klassen.
- **Verteidigung** (13): von Raketenwerfern bis Plasmawerfer, Railgun,
  Tesla-Turm und Schildkuppeln.
- **Bauwarteschlangen** für Gebäude, Forschung und Werft (sequenziell).
- **Voraussetzungssystem**: Gebäude/Forschung schalten weitere Inhalte frei.
- **Galaxie** mit prozedural erzeugten NPC-Planeten (Schwierigkeit steigt mit
  Entfernung), inklusive Distanz-, Flugzeit- und Treibstoffberechnung.
- **Flottenmissionen** in Echtzeit: **Angriff** (mit Beute & Trümmerfeld),
  **Spionage** und **Expedition** (Zufallsereignisse). Flotten fliegen hin,
  lösen die Mission aus und kehren zurück – inkl. **Rückruf**.
- **Kampf-Engine** (rundenbasiert, Schilde/Hülle/Bounce/Explosionen),
  beeinflusst durch Waffen-, Schild- und Panzerungsforschung.
- **Kampfsimulator**: beliebige Flotten gegeneinander testen.
- **Berichtssystem** für Kämpfe, Spionage, Expeditionen und Rückkehr.

## Starten

Da das Spiel ES-Module nutzt, muss es über einen kleinen Webserver laufen
(nicht per Doppelklick auf `index.html`).

**Mit Node.js** (zero-dependency):

```bash
npm start
# oder direkt:
node serve.js
```

**Mit Python** (Alternative, falls kein Node vorhanden):

```bash
python3 -m http.server 8080
```

Dann im Browser öffnen: <http://localhost:8080>

## Projektstruktur

```
.
├── index.html            Einstiegspunkt
├── serve.js              Minimaler statischer Dev-Server
├── styles/main.css       Styling
└── src/
    ├── main.js           App-Bootstrap, Tabs, Tick-Schleife, Events
    ├── data/             Spielinhalte (rein datengetrieben)
    │   ├── buildings.js
    │   ├── research.js
    │   ├── ships.js      ← neue Schiffe hier eintragen
    │   ├── defenses.js
    │   └── galaxy.js     NPC-Generierung, Distanz/Flugzeit/Treibstoff
    ├── engine/           Spiellogik
    │   ├── formulas.js   Kosten / Produktion / Bauzeiten
    │   ├── combat.js     Rundenbasierte Kampf-Engine (testbar, deterministisch)
    │   ├── game.js       Zustand, Tick, Bauwarteschlangen, Flottenmissionen
    │   └── storage.js    Speichern/Laden (localStorage)
    └── ui/
        └── render.js     View-Funktionen
```

## Neue Schiffe hinzufügen

Einfach einen Eintrag in `src/data/ships.js` ergänzen – Kosten, Kampfwerte und
Voraussetzungen. Die Oberfläche und der Bau funktionieren dann automatisch.

## Grafiken / Bilder

Jedes Objekt hat ein Icon (Emoji) als Platzhalter. Echte Bilder lassen sich
ohne Code-Änderung ergänzen: Datei nach `assets/<kategorie>/<id>.png` legen –
sie wird automatisch angezeigt. Vorgaben (Format, Namen, gewünschte Optik) in
[`docs/ART_BRIEF.md`](docs/ART_BRIEF.md), Ablage-Infos in
[`assets/README.md`](assets/README.md). Der Tab **Basis** zeigt deinen Planeten
mit allen Anlagen/Fabriken als Kachelübersicht.

## Spielablauf in Kürze

1. **Gebäude** ausbauen (Minen + Solarkraftwerk), bis Ressourcen fließen.
2. **Roboterfabrik → Raumschiffwerft** bauen, dann erste **Schiffe**.
3. In der **Galaxie** ein nahes (niedriges Tier) NPC-Ziel wählen und eine
   Flotte auf **Angriff** schicken – Fortschritt unter **Flotten**, Ergebnis
   unter **Berichte**.
4. Beute reinvestieren, **Forschung** vorantreiben, größere Flotten bauen.
5. Aufstellungen vorab im **Simulator** testen.

## Multiplayer mit Supabase (in Arbeit)

Ziel ist echtes Multiplayer: gemeinsame Galaxie, Login und serverseitig
gespeicherter, fairer Spielstand. Umsetzung in Phasen:

1. **Fundament** – Auth + DB-Schema, geteilte Galaxie mit echten Spieler-
   planeten, Cloud-Speicher. *(Schema & Anbindung vorbereitet.)*
2. **Server-autoritativ** – Produktion & Bau serverseitig (gegen Cheating).
3. **PvP** – Flotten/Kämpfe gegen echte Spieler per Edge Function.

Das Frontend bleibt statisch auf GitHub Pages und spricht direkt mit Supabase.

### Einrichtung

1. Projekt auf <https://supabase.com> anlegen (Region Europa empfohlen).
2. `supabase/schema.sql` im **SQL Editor** des Dashboards ausführen.
3. **Project Settings → API**: Project URL und `anon public` Key kopieren und
   in `src/net/config.js` eintragen (beide Werte sind öffentlich unbedenklich
   und durch Row-Level-Security geschützt – den `service_role`-Key niemals
   ins Frontend!).
4. **Authentication → Providers → Email** aktivieren (für Tests ggf. „Confirm
   email" deaktivieren).

Solange in `config.js` Platzhalter stehen, läuft das Spiel im lokalen
Offline-Modus (localStorage) weiter.

## Roadmap (weitere Ideen)

- Mehrere Planeten / Kolonien (Astrophysik nutzt bereits den Platz dafür)
- Trümmerfelder einsammeln (Recycler-Mission) & Transport zwischen Planeten
- Monde, Sprungtor, Phalanx-Sensor
- Rapidfire im Kampfmodell, NPC-Gegenangriffe

## Lizenz

MIT – siehe [LICENSE](LICENSE).
