# 🎨 Bild-Assets für Oggame

Hier kommen die Grafiken hin. Sobald eine Datei mit dem **richtigen Namen im
richtigen Ordner** liegt, zeigt das Spiel sie **automatisch** an (vorher bleibt
das Emoji als Platzhalter sichtbar – kein Code-Eingriff nötig).

## Format (wichtig)

| Eigenschaft | Vorgabe |
|---|---|
| Dateiformat | **PNG mit transparentem Hintergrund** |
| Größe | **512 × 512 px** (quadratisch), Motiv mittig |
| Dateiname | exakt die **ID** des Objekts, klein geschrieben, z. B. `lightFighter.png` |
| Gewicht | möglichst < 200 KB pro Bild (für schnelles Laden am Handy) |

> Tipp: WebP geht technisch auch, aber dann müsste die Endung im Code geändert
> werden. Bleib einfach bei **PNG**.

## Ordnerstruktur

```
assets/
├── world/        planet.png            (dein Heimatplanet, Basis-Kopf)
├── buildings/    <gebäude-id>.png
├── research/     <forschung-id>.png
├── ships/        <schiff-id>.png
└── defenses/     <verteidigung-id>.png
```

Die genauen IDs und die gewünschte Optik stehen in **`docs/ART_BRIEF.md`**.

## Beispiel

Legst du `assets/ships/lightFighter.png` ab, erscheint dieses Bild überall, wo
der „Leichte Jäger" auftaucht (Werft-Karte, Basis, später Kampfberichte).
