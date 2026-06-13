# 🎨 Oggame – Art-Brief (Bildvorgaben)

Dieses Dokument beschreibt, **wie jedes Objekt aussehen soll** und **wie die
Datei heißen muss**. Lege fertige Bilder gemäß `assets/README.md` ab – sie
erscheinen dann automatisch im Spiel.

## Einheitlicher Stil (für alle Bilder)

- **Genre:** Science-Fiction / Weltraum, halb-realistisch oder sauberer
  „Game-Art"-Look (klar erkennbar, nicht zu fotorealistisch).
- **Hintergrund:** **transparent** (PNG), Motiv zentriert, etwas Rand lassen.
- **Beleuchtung/Farbe:** dunkle Basis, Akzente in **Blau/Cyan** (#4ea1ff) und
  **Türkis**, passend zum UI-Theme. Ressourcen farblich: Metall = silbergrau,
  Kristall = hellblau, Deuterium = grün-cyan, Energie = gelb.
- **Format:** 512 × 512 px, quadratisch.
- **Perspektive:** Schiffe in **3/4-Seitenansicht** (dynamisch), Gebäude in
  **leichter Iso-/Frontansicht** (wie ein Modell auf dem Planeten),
  Verteidigung wie ein Bodengeschütz/Bauwerk.
- **Konsistenz:** gleicher Blickwinkel & Lichtstil über eine Kategorie hinweg,
  damit Listen einheitlich wirken. Größere/teurere Einheiten dürfen klar
  imposanter und detaillierter sein.

---

## 🪐 Welt

| Datei | Beschreibung |
|---|---|
| `world/planet.png` | Bewohnter Heimatplanet aus dem Orbit: blau-grüne Welt mit Wolken, Atmosphären-Glanzkante, ein paar Lichter der Zivilisation auf der Nachtseite. |

## 🏗️ Gebäude (`assets/buildings/`)

| Datei (ID) | Name | Beschreibung |
|---|---|---|
| `metalMine.png` | Metallmine | Industrielle Tagebau-/Bohranlage, Förderturm, Förderbänder, rostig-metallisch. |
| `crystalMine.png` | Kristallmine | Mine, aus der leuchtend hellblaue Kristalle ragen; Schürf-Laser/Gerüste. |
| `deuteriumSynth.png` | Deuteriumsynthetisierer | Raffinerie mit Tanks und Rohren, grün-cyan leuchtende Flüssigkeit. |
| `solarPlant.png` | Solarkraftwerk | Große Solarpaneel-Felder, die gelb-warm reflektieren. |
| `fusionPlant.png` | Fusionskraftwerk | Kuppelreaktor mit pulsierendem Energiekern, Kühltürme. |
| `metalStorage.png` | Metallspeicher | Große silbrige Lagertanks/Silos. |
| `crystalStorage.png` | Kristallspeicher | Hellblau schimmernde Lagerhallen/Container. |
| `deuteriumTank.png` | Deuteriumtank | Runde Drucktanks mit grün-cyan Inhalt. |
| `roboticsFactory.png` | Roboterfabrik | Werkshalle mit Roboterarmen am Fließband. |
| `naniteFactory.png` | Nanitenfabrik | High-Tech-Reinraum, schwebende Nanobot-Schwärme, blaues Glühen. |
| `shipyard.png` | Raumschiffwerft | Orbital-/Boden-Dock mit Schiffsgerüst im Bau, Kräne, Funken. |
| `researchLab.png` | Forschungslabor | Modernes Labor mit Hologramm-Displays, blaue Datenprojektionen. |
| `allianceDepot.png` | Allianzdepot | Versorgungs-/Tankdepot mit Andockstutzen und Treibstoffleitungen. |
| `terraformer.png` | Terraformer | Gewaltige Maschine, die Landschaft umformt; grün werdende Oberfläche. |

## 🔬 Forschung (`assets/research/`)

Als **Icons/Embleme** denkbar (Symbol auf rundem Tech-Badge), nicht zwingend Szenen.

| Datei (ID) | Name | Beschreibung |
|---|---|---|
| `energyTech.png` | Energietechnik | Blitz-/Energiesymbol in einem Reaktorring. |
| `laserTech.png` | Lasertechnik | Gebündelter roter Laserstrahl durch eine Linse. |
| `ionTech.png` | Ionentechnik | Wirbelnde blaue Ionenpartikel/Plasmaring. |
| `plasmaTech.png` | Plasmatechnik | Glühender violetter Plasmaball mit Entladungen. |
| `hyperspaceTech.png` | Hyperraumtechnik | Verzerrtes Raum-Zeit-Gitter / Wurmloch. |
| `combustionDrive.png` | Verbrennungstriebwerk | Klassische Raketendüse mit Flammenstrahl. |
| `impulseDrive.png` | Impulstriebwerk | Glühende Ionendüse mit blauem Schweif. |
| `hyperspaceDrive.png` | Hyperraumantrieb | Triebwerk, das einen Sprungtunnel öffnet. |
| `espionageTech.png` | Spionagetechnik | Auge/Satellitenschüssel mit Radarwellen. |
| `computerTech.png` | Computertechnik | Platine/CPU mit leuchtenden Datenbahnen. |
| `astrophysics.png` | Astrophysik | Teleskop vor Sternenfeld/Galaxie. |
| `researchNetwork.png` | Intergalaktisches Netzwerk | Vernetzte Planeten/Knoten mit Datenlinien. |
| `graviton.png` | Gravitonforschung | Schwarzes Loch / gekrümmtes Gravitationsfeld. |
| `weaponsTech.png` | Waffentechnik | Gekreuzte Energiewaffen / Zielkreuz. |
| `shieldTech.png` | Schildtechnik | Hexagonales Energieschild, das einen Treffer abfängt. |
| `armorTech.png` | Raumschiffpanzerung | Geschichtete Panzerplatte mit Nieten/Glanz. |

## 🚀 Schiffe (`assets/ships/`)

### Zivilschiffe
| Datei (ID) | Name | Beschreibung |
|---|---|---|
| `smallCargo.png` | Kleiner Transporter | Kompakter, gedrungener Frachter mit kleinem Containermodul. |
| `largeCargo.png` | Großer Transporter | Längerer Frachter mit mehreren Containersektionen. |
| `hugeCargo.png` | Riesentransporter | Massiver Massengutfrachter, rückgratartiger Containerrumpf. |
| `tanker.png` | Deuteriumtanker | Frachter mit großen runden Treibstofftanks, grün-cyan Leitungen. |
| `colonyShip.png` | Kolonieschiff | Rundliches Schiff mit Habitatmodulen/Kuppel, friedlich. |
| `recycler.png` | Recycler | Plumpes Schiff mit Greifarmen/Trichter zum Einsammeln von Schrott. |
| `espionageProbe.png` | Spionagesonde | Winzige, schnelle Drohne mit Sensorantennen. |
| `solarSatellite.png` | Solarsatellit | Kleiner Satellit mit ausgeklappten Solarflügeln (unbewaffnet). |
| `crawler.png` | Schürfer | Bodengebundene Minendrohne auf Ketten/Beinen. |
| `pathfinder.png` | Pfadfinder | Schlankes Erkundungsschiff mit Sensorkanzel und Bergungsarm. |

### Jäger & leichte Schiffe
| Datei (ID) | Name | Beschreibung |
|---|---|---|
| `lightFighter.png` | Leichter Jäger | Kleiner, agiler Sternjäger mit Doppelkanonen, scharfe Linien. |
| `heavyFighter.png` | Schwerer Jäger | Robusterer Jäger, dickere Panzerung, größere Triebwerke. |
| `interceptor.png` | Abfangjäger | Extrem schlank/pfeilförmig, übergroße Triebwerke (Speed). |
| `corvette.png` | Korvette | Kleines Kriegsschiff mit mehreren Geschütztürmen. |
| `cruiser.png` | Kreuzer | Schnelles, mittelgroßes Kriegsschiff, elegante aggressive Form. |

### Großkampfschiffe
| Datei (ID) | Name | Beschreibung |
|---|---|---|
| `frigate.png` | Fregatte | Ausgewogenes Linienschiff, mehrere Türme, solide Brücke. |
| `battleship.png` | Schlachtschiff | Wuchtiges Großkampfschiff, schwere Frontgeschütze. |
| `battlecruiser.png` | Schlachtkreuzer | Schlanker als Schlachtschiff, energiegeladene Lasertürme. |
| `heavyCruiser.png` | Schwerer Kreuzer | Dick gepanzert, kantig, mit Ionengeschützen (blaue Mündungen). |
| `bomber.png` | Bomber | Massiges, langsames Schiff mit Plasmawerfer-Schächten an der Unterseite. |
| `destroyer.png` | Zerstörer | Imposantes, schwer bewaffnetes Kriegsschiff, dominanter Bug. |
| `plasmaCruiser.png` | Plasmakreuzer | Kreuzer mit glühend violetten Plasma-Geschütztürmen. |
| `dreadnought.png` | Dreadnought | Brachialer Schlachtkoloss, dichte Geschützbatterien überall. |
| `carrier.png` | Träger | Langer Trägerrumpf mit Start-/Landedecks für Jäger. |
| `titan.png` | Titan | Gigantisches Superschlachtschiff, ehrfurchtgebietend, Stadt-große Silhouette. |
| `reaper.png` | Schnitter | Bedrohliches Schiff mit sichelartigen Auslegern, dunkel, rote Akzente. |
| `leviathan.png` | Leviathan | Organisch wirkendes Biotech-Schiff, lebendige gepanzerte Hülle, biolumineszent. |
| `deathstar.png` | Todesstern | Mondgroße kugelförmige Kampfstation mit gewaltigem Hauptgeschütz/Krater. |

### Spezialschiffe
| Datei (ID) | Name | Beschreibung |
|---|---|---|
| `stealthShip.png` | Phantom | Kantiges Tarnkappenschiff, dunkel/matt, leicht durchscheinend (Tarnfeld). |
| `gunship.png` | Kanonenboot | Kleines Schiff mit überproportional großem Hauptgeschütz. |
| `ionFrigate.png` | Ionenfregatte | Fregatte mit großen ringförmigen Ionenkanonen, blaues Leuchten. |

## 🛡️ Verteidigung (`assets/defenses/`)

Bodengebundene Geschütze/Bauwerke auf einer Plattform (Frontansicht).

| Datei (ID) | Name | Beschreibung |
|---|---|---|
| `rocketLauncher.png` | Raketenwerfer | Einfaches Raketengestell auf Sockel, mehrere Startrohre. |
| `lightLaser.png` | Leichtes Lasergeschütz | Kompakter Laserturm mit kleinem Schildgenerator. |
| `heavyLaser.png` | Schweres Lasergeschütz | Größerer Laserturm mit Doppelläufen, Kühlrippen. |
| `gaussCannon.png` | Gaußkanone | Lange Schienenkanone auf schwerer Lafette, elektromagnetische Spulen. |
| `ionCannon.png` | Ionengeschütz | Turm mit dickem ringförmigen Ionen-Emitter, kräftiges blaues Glühen. |
| `plasmaTurret.png` | Plasmawerfer | Massiver Turm, glühend violette Plasmamündung. |
| `teslaTower.png` | Tesla-Turm | Hoher Turm mit Tesla-Spule, knisternde Blitze. |
| `railgun.png` | Railgun-Batterie | Sehr lange Doppel-Schienenkanone, futuristisch, scharfkantig. |
| `flakCannon.png` | Flak-Geschütz | Schnellfeuer-Mehrrohrgeschütz (Jägerabwehr). |
| `smallShieldDome.png` | Kleine Schildkuppel | Niedrige Energiekuppel über einem Generator, leicht transparent. |
| `largeShieldDome.png` | Große Schildkuppel | Große, kräftig leuchtende Energiekuppel, hexagonales Schildmuster. |
| `interplanetaryMissile.png` | Interplanetarrakete | Große Angriffsrakete im Startsilo/auf Rampe. |

---

## So lieferst du die Bilder

1. Erzeuge/beschaffe die PNGs gemäß den Vorgaben oben (512×512, transparent).
2. Benenne jede Datei **exakt nach der ID** (z. B. `destroyer.png`).
3. Lege sie in den passenden Ordner unter `assets/`.
4. Schick sie mir (oder commit sie selbst) – sie erscheinen dann automatisch.

Du musst **nicht alle auf einmal** liefern – jedes Bild taucht einzeln auf,
sobald es da ist. Fehlende behalten ihr Emoji.
