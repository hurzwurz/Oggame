# 🎨 Auftrag für dein Bild-Tool – fehlende Oggame-Icons
Erzeuge die unten gelisteten Icons. **Wichtig für die automatische Zuordnung:**
ordne sie als **beschriftetes Raster** in **genau dieser Reihenfolge** an,
ein Icon pro Zelle, mit dem **deutschen Namen als Beschriftung darunter**,
und **klaren Trennlinien** zwischen den Zellen.

## Stil (für ALLE Bilder gleich)
- Science-Fiction, sauberer Game-Art-Look, **dunkler Hintergrund**, Akzente in **Blau/Cyan**.
- Motiv **zentriert**, einheitlicher Blickwinkel & Lichtstil je Kategorie.
- Gleicher Stil wie das bisherige Set (passt zum Spiel-UI).

## Format
- Quadratische Zellen, **512×512 px** pro Icon, möglichst transparenter oder dunkler Hintergrund.
- Ausgabe als **ein Bild** (Raster) **mit klaren weißen Trennlinien**, oder einzeln als PNG.

## GEBÄUDE — leichte Iso-/Frontansicht (Gebäude-Modell)
| # | Name | Dateiname | Motiv |
|---|---|---|---|
| 1 | **Metallspeicher** | `buildings/metalStorage.png` | große silberne Lagersilos/Tanks für Metall |
| 2 | **Kristallspeicher** | `buildings/crystalStorage.png` | Lagerhallen mit hellblau leuchtenden Kristall-Containern |
| 3 | **Deuteriumtank** | `buildings/deuteriumTank.png` | runde Drucktanks mit grün-cyan leuchtendem Deuterium |

## FORSCHUNG — Icon/Emblem, ein Symbol mittig
| # | Name | Dateiname | Motiv |
|---|---|---|---|
| 4 | **Ionentechnik** | `research/ionTech.png` | wirbelnde blaue Ionenpartikel als Ring – Tech-Emblem |
| 5 | **Plasmatechnik** | `research/plasmaTech.png` | glühender violetter Plasmaball mit Entladungen – Tech-Emblem |
| 6 | **Verbrennungstriebwerk** | `research/combustionDrive.png` | Raketendüse mit Flammenstrahl – Tech-Emblem |
| 7 | **Impulstriebwerk** | `research/impulseDrive.png` | leuchtende Ionendüse mit blauem Schweif – Tech-Emblem |
| 8 | **Hyperraumantrieb** | `research/hyperspaceDrive.png` | Triebwerk öffnet einen Sprungtunnel – Tech-Emblem |
| 9 | **Spionagetechnik** | `research/espionageTech.png` | Auge + Satellitenschüssel mit Radarwellen – Tech-Emblem |
| 10 | **Intergalaktisches Forschungsnetzwerk** | `research/researchNetwork.png` | vernetzte Planeten mit Datenlinien – Tech-Emblem |
| 11 | **Raumschiffpanzerung** | `research/armorTech.png` | geschichtete Panzerplatte mit Nieten – Tech-Emblem |

## SCHIFFE — dynamische 3/4-Seitenansicht
| # | Name | Dateiname | Motiv |
|---|---|---|---|
| 12 | **Riesentransporter** | `ships/hugeCargo.png` | riesiger Massengutfrachter mit rückgratartigem Containerrumpf |
| 13 | **Deuteriumtanker** | `ships/tanker.png` | Tankschiff mit großen runden Treibstofftanks, cyan Leitungen |
| 14 | **Spionagesonde** | `ships/espionageProbe.png` | winzige schnelle Aufklärungsdrohne mit Sensorantennen |
| 15 | **Solarsatellit** | `ships/solarSatellite.png` | kleiner unbewaffneter Satellit mit Solarflügeln |
| 16 | **Schürfer** | `ships/crawler.png` | bodengebundene Minendrohne auf Ketten mit Bohrarmen |
| 17 | **Abfangjäger** | `ships/interceptor.png` | extrem schlanker, pfeilförmiger Abfangjäger mit großen Triebwerken |
| 18 | **Korvette** | `ships/corvette.png` | kleines Kriegsschiff mit mehreren Geschütztürmen |
| 19 | **Fregatte** | `ships/frigate.png` | ausgewogenes Linienschiff mit mehreren Türmen und Brücke |
| 20 | **Schwerer Kreuzer** | `ships/heavyCruiser.png` | dick gepanzerter, kantiger Kreuzer mit Ionengeschützen |
| 21 | **Plasmakreuzer** | `ships/plasmaCruiser.png` | Kreuzer mit glühend violetten Plasma-Türmen |
| 22 | **Dreadnought** | `ships/dreadnought.png` | brachialer Schlachtkoloss mit dichten Geschützbatterien |
| 23 | **Träger** | `ships/carrier.png` | langer Träger mit Start-/Landedecks für Jäger |
| 24 | **Titan** | `ships/titan.png` | gigantisches Superschlachtschiff, stadtgroße Silhouette |
| 25 | **Schnitter** | `ships/reaper.png` | bedrohliches Schiff mit sichelartigen Auslegern, dunkel mit roten Akzenten |
| 26 | **Ionenfregatte** | `ships/ionFrigate.png` | Fregatte mit großen ringförmigen Ionenkanonen, blaues Leuchten |

## VERTEIDIGUNG — Bodengeschütz auf kleiner Plattform, Front-3/4
| # | Name | Dateiname | Motiv |
|---|---|---|---|
| 27 | **Schweres Lasergeschütz** | `defenses/heavyLaser.png` | größerer Laserturm mit Doppelläufen und Kühlrippen |
| 28 | **Flak-Geschütz** | `defenses/flakCannon.png` | Schnellfeuer-Mehrrohr-Flakgeschütz |

**Gesamt benötigt: 32 Icons.** Bereits vorhandene Objekte nicht nötig.

## Master-Prompt (zum Einfügen ins Tool)
```
Create a sprite sheet of sci-fi game icons in a consistent style: clean game art, dark background, blue and cyan accent lighting, dramatic rim light, each subject centered in its own square cell, arranged in a labeled grid with the German name written below each icon and clear white separator lines between cells. Buildings in slight isometric view, ships in dynamic 3/4 side view, research as round emblem icons, defenses as ground turrets. Produce one icon per item in this exact order:
1. Metallspeicher (große silberne Lagersilos/Tanks für Metall); 2. Kristallspeicher (Lagerhallen mit hellblau leuchtenden Kristall-Containern); 3. Deuteriumtank (runde Drucktanks mit grün-cyan leuchtendem Deuterium); 4. Ionentechnik (wirbelnde blaue Ionenpartikel als Ring – Tech-Emblem); 5. Plasmatechnik (glühender violetter Plasmaball mit Entladungen – Tech-Emblem); 6. Verbrennungstriebwerk (Raketendüse mit Flammenstrahl – Tech-Emblem); 7. Impulstriebwerk (leuchtende Ionendüse mit blauem Schweif – Tech-Emblem); 8. Hyperraumantrieb (Triebwerk öffnet einen Sprungtunnel – Tech-Emblem); 9. Spionagetechnik (Auge + Satellitenschüssel mit Radarwellen – Tech-Emblem); 10. Intergalaktisches Forschungsnetzwerk (vernetzte Planeten mit Datenlinien – Tech-Emblem); 11. Raumschiffpanzerung (geschichtete Panzerplatte mit Nieten – Tech-Emblem); 12. Riesentransporter (riesiger Massengutfrachter mit rückgratartigem Containerrumpf); 13. Deuteriumtanker (Tankschiff mit großen runden Treibstofftanks, cyan Leitungen); 14. Spionagesonde (winzige schnelle Aufklärungsdrohne mit Sensorantennen); 15. Solarsatellit (kleiner unbewaffneter Satellit mit Solarflügeln); 16. Schürfer (bodengebundene Minendrohne auf Ketten mit Bohrarmen); 17. Abfangjäger (extrem schlanker, pfeilförmiger Abfangjäger mit großen Triebwerken); 18. Korvette (kleines Kriegsschiff mit mehreren Geschütztürmen); 19. Fregatte (ausgewogenes Linienschiff mit mehreren Türmen und Brücke); 20. Schwerer Kreuzer (dick gepanzerter, kantiger Kreuzer mit Ionengeschützen); 21. Plasmakreuzer (Kreuzer mit glühend violetten Plasma-Türmen); 22. Dreadnought (brachialer Schlachtkoloss mit dichten Geschützbatterien); 23. Träger (langer Träger mit Start-/Landedecks für Jäger); 24. Titan (gigantisches Superschlachtschiff, stadtgroße Silhouette); 25. Schnitter (bedrohliches Schiff mit sichelartigen Auslegern, dunkel mit roten Akzenten); 26. Ionenfregatte (Fregatte mit großen ringförmigen Ionenkanonen, blaues Leuchten); 27. Schweres Lasergeschütz (größerer Laserturm mit Doppelläufen und Kühlrippen); 28. Flak-Geschütz (Schnellfeuer-Mehrrohr-Flakgeschütz).
```
