# 🚀 Oggame

Ein **OGame-inspiriertes Weltraum-Strategiespiel** für den Browser – mit einer
bewusst großen Schiffsdatenbank und vollständig datengetriebenem Spielinhalt.

Aktueller Stand: spielbares **Single-Player-MVP** mit Ressourcenwirtschaft,
Gebäuden, Forschung, Schiffsbau und Verteidigung. Läuft komplett im Browser,
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
    │   └── defenses.js
    ├── engine/           Spiellogik
    │   ├── formulas.js   Kosten / Produktion / Bauzeiten
    │   ├── game.js       Zustand, Tick, Bauwarteschlangen
    │   └── storage.js    Speichern/Laden (localStorage)
    └── ui/
        └── render.js     View-Funktionen
```

## Neue Schiffe hinzufügen

Einfach einen Eintrag in `src/data/ships.js` ergänzen – Kosten, Kampfwerte und
Voraussetzungen. Die Oberfläche und der Bau funktionieren dann automatisch.

## Roadmap (Ideen)

- Mehrere Planeten / Kolonien (Astrophysik nutzt bereits den Platz dafür)
- Flottenbewegungen & Kampfsimulator zwischen Planeten
- Galaxie-Ansicht, Trümmerfelder & Recycling
- Monde, Sprungtor, Phalanx-Sensor
- Multiplayer-Backend

## Lizenz

MIT – siehe [LICENSE](LICENSE).
