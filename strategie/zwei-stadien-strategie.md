# Zwei- (eigentlich drei-) Stadien-Strategie: Ärzte-Domino → Patienten-MdE → GdB

## Update: die Kausalitätsfrage als Einstieg, nicht als Hindernis

Der ursprüngliche Einwand war: Kausalität (war die Infektion beruflich?) ist eine Beweisfrage, bei der ein Symptom-Chat nicht helfen kann. Das stimmt weiterhin für die **Betroffenen-Perspektive**. Aber es gibt einen zweiten Hebel an genau dieser Stelle, den du zu Recht siehst: **die meldenden Ärzt:innen selbst.**

**Rechtlich fundiert, nicht nur plausibel**: Nach § 202 SGB VII sind Ärzt:innen bei begründetem Verdacht auf eine Berufskrankheit zur unverzüglichen Meldung verpflichtet — ohne Einwilligungserfordernis, und diese Pflicht geht der ärztlichen Schweigepflicht vor (vom BSG in einem Fall bestätigt, in dem eine unterlassene Meldung zum Rechtsverlust der Hinterbliebenen führte). Das ist keine Kann-Bestimmung.

**Der Arbeitgeber-Kanal ist strukturell blockiert**: Auch Arbeitgeber haben eine Meldepflicht (§ 193 SGB VII), kommen ihr aber laut einer Stellungnahme im Bundestags-Pandemie-Ausschuss oft nicht nach — aus Sorge, eine Erkrankung am Arbeitsplatz signalisiere Versagen der eigenen Prävention, und aus Sorge vor steigenden UV-Beiträgen. Das ist ein struktureller Interessenkonflikt, der sich kaum auflösen lässt.

**Der Ärzte-Kanal umgeht dieses Problem komplett**: Die ärztliche Meldepflicht ist von der Mitwirkung des Arbeitgebers unabhängig. Wenn ein Arzt/eine Ärztin den Zusammenhang zwischen aktueller Fatigue/PEM-Symptomatik und einer 2–3 Jahre zurückliegenden beruflichen COVID-Infektion erkennt, kann gemeldet werden — ganz ohne Arbeitgeber-Beteiligung.

## Warum das plausibel den größten Hebel hat

- Die eigentliche Lücke liegt wahrscheinlich nicht bei fehlenden Fällen, sondern beim fehlenden **Erkennen des Zusammenhangs** durch die behandelnden Ärzt:innen. Post-COVID/ME-CFS zeigt sich oft erst Monate bis Jahre nach der akuten Infektion, wird häufig von einem anderen Arzt/einer anderen Fachrichtung behandelt als die Akutinfektion (Hausarzt, Neurologie, Innere Medizin) — der berufliche Ursprung ist dann nicht mehr präsent, wenn niemand gezielt danach fragt.
- Ein Arzt/eine Ärztin sieht nicht einen Fall, sondern über die Zeit **Dutzende bis Hunderte** potenziell betroffene Patient:innen — der Hebel pro erreichter Person ist um Größenordnungen höher als bei einem patientenfacing Tool.
- Du selbst bist Teil dieser "Medical Bubble" (Thoraxchirurgie, Lungenzentrum) — direkter Netzwerkzugang zu Kolleg:innen, D-Ärzt:innen, Hausärzt:innen in deinem Umfeld, ohne Kaltakquise.
- Rechtlich sauberere Ausgangslage als beim patientenfacing Tool: Hier geht es um Aufklärung über eine **bestehende gesetzliche Pflicht** unter Fachkolleg:innen, nicht um eine KI-Einschätzung gegenüber medizinischen Laien — geringeres RDG-/Haftungsrisiko als beim Patienten-Tool.

## Wichtig: Das ist ein anderes Produkt, nicht nur ein anderer Systemprompt

Anders als der Übergang von Stadium 1 (BG) zu Stadium 2 (GdB), der praktisch dieselbe Engine nutzt, ist das Ärzte-Tool **strukturell verschieden**:
- Zielgruppe sind Fachkolleg:innen, keine Laien — Ton, Tiefe, Format ändern sich komplett.
- Die Aufgabe ist nicht "Symptome interpretieren", sondern **"Erkenne das Muster, kenne deine Meldepflicht, hier ist das Formular"** — eher eine kompakte klinische Entscheidungshilfe/Checkliste als ein Interview-Chat. Denkbar: ein kurzer Reminder/Decision-Support in der Sprechstunden-Dokumentation ("Patient mit Gesundheitsdienst-Anamnese + Fatigue/PEM-Symptomatik >6 Monate nach dokumentierter COVID-Infektion — Verdacht auf BK 3101 prüfen?") statt eines 15-Minuten-Gesprächs.
- Wiederverwendbar bleibt die **Wissensbasis** (BK-3101-Kriterien, CCC-Kriterien, VersMedV) — nicht die Interaktionslogik.

## Aktualisierte Stadienfolge

## Produktstruktur: zwei Arme, eine Engine

Damit ist die Struktur entschieden, nicht nur skizziert:

- **BASTET** (Betroffenen-Arm): geführtes Chat-Interview, 15-Minuten-Zeitbudget, Diagnose-Gate, Krisensicherheit, Referenzen-Button. Zielgruppe: Patient:innen.
- **BASTET · Doc** (Ärzte-Arm): strukturiertes CCC-Formular (Chips statt Chat), Meldepflicht-Banner (§ 202 SGB VII), diagnostische-Sicherheit-Feld statt Diagnose-Gate. Zielgruppe: Fachkolleg:innen.

Beide Arme teilen sich: dieselbe Wissensbasis (VersMedV, CCC, MdE-Kausalitätsstufen, Kalibrierungsanker), dasselbe Referenzen-Prinzip ([n]-Marker → REFERENZEN-Block → einklappbare Liste), denselben Grundsatz "GdB UND MdE immer beide begründet, nie stillschweigend weggelassen", dasselbe No-Storage-Prinzip. Unterschiedlich sind nur Eingabeform (Interview vs. Formular), Tonalität (patientengerecht vs. kollegial-fachlich) und die Sicherheits-Gates (Diagnose-Gate beim Patiententool vs. Meldepflicht-Hinweis beim Ärztetool).

Für den Build-Plan bedeutet das: beide Arme laufen im selben Cloudflare Worker über zwei Routen (z. B. `/chat` für den Betroffenen-Arm, `/doc` für den Ärzte-Arm), mit gemeinsamer `knowledgeBase.ts`, aber getrennten System-Prompt-Bausteinen. Kein zweites Backend nötig.

**Stadium 1a — Ärzte-Domino (neuer, wahrscheinlich wirksamster Einstieg)**
Zwei Komponenten, dieselbe Engine, unterschiedliche Reife:
1. *Aufklärung*: Meldepflicht nach § 202 SGB VII, Erkennungsmuster für beruflich bedingtes Post-COVID/ME-CFS, direkter Link zum Meldeformular (DGUV Vordruck F 6000).
2. *BASTET · Doc — Orientierungsprodukt*: Ärzt:innen geben anonymisiert Anamnese und Befund ein (strukturiertes Formular statt Chat-Interview — sie kennen den Fall bereits) und erhalten dieselbe zitatbelegte GdB/MdE-Spannen-Einschätzung wie im Patiententool, nur als fachliche Zweitmeinung/Orientierung statt als Patientenkommunikation. Höherer Nutzwert als reine Aufklärung, dadurch wahrscheinlich bessere Akzeptanz.

Vertrieb über dein eigenes berufliches Netzwerk, Fachfortbildungen, ggf. Fachgesellschaften (DGOU, Betriebsärzteverbände). Ziel: mehr korrekt erkannte und gemeldete Fälle → wächst den Pool für 1b.

**Unterschiede zum Patiententool, die beim Bau zu beachten sind:**
- **Eingabeform**: strukturiertes Formular (Anamnese-Felder, Befund-Stichpunkte) statt geführtes 15-Minuten-Gespräch — Ärzt:innen wollen keine Interview-Führung, sie liefern den Fall bereits aufbereitet.
- **Anonymisierung als Vorteil, nicht nur Pflicht**: Ohne Namen/Fallnummern sind das im Zweifel gar keine personenbezogenen Daten mehr im DSGVO-Sinne — einfacher als beim Patiententool. Cave: seltene Symptom-/Berufskombinationen können auch anonymisiert re-identifizierend wirken (Mosaik-Effekt) — Hinweis im Formular, keine seltenen Zusatzmerkmale einzugeben, die eine Zuordnung erlauben.
- **Haftungsprofil verschiebt sich, verschwindet aber nicht**: Peer-to-peer (eine fachliche Informationsquelle unter mehreren) ist rechtlich entspannter als KI-Output direkt an Laien — aber eine unreflektiert ins Gutachten übernommene KI-Einschätzung ist heikler, weil sie dann in eine förmliche Entscheidung einfließt. Der "ersetzt keine eigene fachliche Prüfung"-Hinweis bleibt zwingend, nur anders formuliert als beim Patiententool.
- **Gleiche Engine, gleiche Wissensbasis, gleiches Referenzen-Prinzip** — nur Input-Weg und Tonalität der Ausgabe unterscheiden sich vom Patiententool. Kein Neubau der Kernlogik.

**Stadium 1b — Patienten-MdE (bereits gebauter Prototyp)**
Für Menschen mit bereits anerkannter BK-3101: Vorbegutachtungs-Interview zur MdE-Einschätzung, wie bisher konzipiert. Profitiert direkt vom wachsenden Fallpool aus 1a.

**Stadium 2 — GdB (breiter Rollout)**
Wie zuvor besprochen: gleiche Engine wie 1b, Wissensbasis-Schwerpunkt verschiebt sich auf VersMedV/Schwerbehindertenrecht, Zielgruppe wird auf alle 1,4–1,5 Mio. Betroffenen ausgeweitet, nicht nur den BG-Zuständigkeitsbereich.

## Offene Frage, die die Reihenfolge noch beeinflussen könnte
1a und 1b lassen sich parallel angehen, da sie unterschiedliche Zielgruppen und unterschiedlichen Bauaufwand haben — 1a ist vermutlich sogar schneller umsetzbar (kompakte Checkliste statt Chat-Interview) und könnte zuerst live gehen, während 1b weiter reift.

## Ergänzung: Warum die Fallzahl-Größenordnung die Kausalitätsfrage entschärft

Ein Einwand aus der Diskussion, der die obige Einschätzung präzisiert: Die einzige gefundene Präzedenzentscheidung gegen eine Fatigue-Folgeerkrankung (LSG, Q-Fieber/BK 3102) betrifft ein Krankheitsbild mit wenigen Fällen pro Jahr — dort kann eine einzelne Entscheidung faktisch "herrschende Meinung" bleiben, weil es kaum Gegenklagen gibt. Bei Post-COVID im BG-Bereich (fünfstellige Größenordnung) entsteht dagegen zwangsläufig eine viel dichtere Fallpraxis, die sich tendenziell zu einer konsistenteren, klägerfreundlicheren Linie einpendelt — gestützt durch bereits vorhandene politische Aufmerksamkeit (Bundestags-Ausschussbefassung, 500-Mio.-€-BMFTR-Forschungsdekade) und die politisch gut organisierte, sichtbare Zielgruppe (Gesundheitsberufe).

**Wichtige Differenzierung für die Produktpositionierung**: Politisch riskant ist eine *sichtbare, systematische* Ablehnung. Der wahrscheinlichere Reflex einer kostenbelasteten Trägerin (BGW: 117,8 Mio. €/Jahr COVID-bedingt) ist eher **Reibung** als offene Ablehnung — hohe Dokumentationsanforderungen, Rückfragen, lange Bearbeitungszeiten, die gerade bei Brain-Fog-Betroffenen zum stillen Aufgeben führen, ohne dass eine politisch auffällige "Ablehnung" sichtbar wird. Das bestätigt eher als schwächt die Produktidee: Der Wert liegt nicht darin, gegen eine feindliche Institution zu argumentieren, sondern eine von Anfang an sauber dokumentierte, zitierbelegte AU-/Symptomkette zu liefern, die genau diese Reibung reduziert.

**Konsequenz für Stadium 1b**: Der Fokus auf die haftungsausfüllende Kausalität (AU-/Symptomkette seit anerkannter Erstinfektion, Beweismaßstab "hinreichende Wahrscheinlichkeit") bleibt der richtige, frühere Eingriffspunkt — mit zusätzlichem Rückenwind durch die Größenordnung und die politische Sichtbarkeit des Themas, nicht nur durch die reine Rechtslage.

## Der wichtigste Stolperstein, den ihr im Blick behalten solltet: zwei Kausalitätsstufen sauber trennen

Bei GdB ist die Frage rein medizinisch-funktional: "Wie stark beeinträchtigt Sie das?" Bei MdE/BG kommt eine zusätzliche Ebene dazu, die sich in zwei Stufen zerlegt (Beweismaßstäbe nach BSG-Rechtsprechung, Vortrag Dr. Bieresborn, Richter am BSG):

| Prüfungsschritt | Beweismaßstab |
|---|---|
| Versicherte Tätigkeit | Vollbeweis |
| Einwirkungskausalität (Tätigkeit → Exposition) | Hinreichende Wahrscheinlichkeit |
| **Haftungsbegründende Kausalität** (Exposition → Erstinfektion/Primärschaden) | Hinreichende Wahrscheinlichkeit |
| Erstinfektion selbst | Vollbeweis |
| **Haftungsausfüllende Kausalität** (Erstinfektion → Folgeschäden wie Post-COVID/ME-CFS) | Hinreichende Wahrscheinlichkeit |
| Folgeschaden selbst | Vollbeweis |

Für Stadium 1b entscheidend: Ist die Erstinfektion bereits als BK-3101 anerkannt (häufig weitgehend formal, bei dokumentierter beruflicher Exposition im Gesundheitsdienst), gilt für den Zusammenhang zur heutigen Post-COVID/ME-CFS-Symptomatik **derselbe abgesenkte Maßstab** wie für die Erstursache — hinreichende Wahrscheinlichkeit, kein Vollbeweis. Eine durchgehend dokumentierte Kette aus AU-Zeiten mit passender Symptomatik seit der Infektion ist genau die Art Beweis, die dafür ausreicht. Das Tool sollte also nicht erst bei bereits vollständig anerkannten Fällen ansetzen, sondern schon bei anerkanntem Erstschaden aktiv beim Dokumentieren dieser Kette helfen (siehe unten, technische Konsequenz).

Eine reale Gegenentscheidung (LSG, Q-Fieber → Fatigue-Syndrom als BK-Folge abgelehnt) zeigt: der abgesenkte Maßstab ist kein Automatismus — es braucht eine wirklich stimmige, lückenlose Kette, keine Notiz "ist wohl seit damals müde". Das ist der Qualitätsmaßstab, auf den das Interview hinarbeiten sollte.

**Konsequenz für den Zuschnitt von Stadium 1b**: Zielgruppe ist "BK-3101-Erstschaden anerkannt" (nicht: "vollständig als Post-COVID/ME-CFS-Fall durchentschieden"). Aufgabe des Interviews: strukturiert die AU-/Symptomkette seit der anerkannten Infektion erfassen (Daten, Dauer, Symptomkontinuität, Passung zu CCC-Kriterien) — das liefert genau das Material für den "hinreichende Wahrscheinlichkeit"-Nachweis der Folgeschäden, zusätzlich zur bereits bestehenden MdE-Schweregrad-Einschätzung.

## Vertriebs-/Zugangsweg für Stadium 1b

Zwei denkbare Richtungen, die sich nicht ausschließen:
- **Betroffenenseitig** (empfehlenswerter Startpunkt): über Fatigatio (Sozialteam berät schon jetzt zu genau diesen Fragen), mecfs.de, Long-COVID-Selbsthilfegruppen, Fachanwält:innen für Sozialrecht, die BGW-Fälle vertreten. Interessen sind hier eindeutig auf Seiten der Betroffenen ausgerichtet — kein Interessenkonflikt.
- **Institutionell** (BGW direkt): riskanter, siehe unten. Falls ihr diesen Weg später prüft: eher über die Reha-Kliniken/Post-COVID-Check-Programme der BG Kliniken als Kooperationspartner positionieren (passt zum Prinzip "Reha vor Rente"), nicht als Tool, das gegen Bescheide vorgeht.
- Für **Stadium 1a (Ärzte)** ist die Institution kein Risiko, sondern potenzieller Multiplikator: Fachgesellschaften, Fortbildungsanbieter, ärztliche Netzwerke sind natürliche Partner, weil es um Aufklärung über eine ohnehin bestehende Pflicht geht, nicht um eine Gegenposition zur BG.

## Übergangskriterien: Wann zu Stadium 2 (GdB) wechseln?

Sinnvolle Signale, bevor ihr den Fokus erweitert:
- Eine erkennbare Zahl abgeschlossener Interviews (1b) mit brauchbarem Nutzer-Feedback zur Interview-Länge, Tonalität, Zitat-Qualität
- Mindestens ein dokumentierter Fall, in dem die Auswertung tatsächlich in einem Antrags-/Widerspruchsverfahren verwendet wurde — auch anekdotisch, als Realitätscheck
- Keine unentdeckten Sicherheitslücken bei den Pflicht-Gates (Diagnose-Gate, Speicherhinweis, Kriseninterventions-Logik) über einen gewissen Zeitraum echter Nutzung
- Für 1a: messbarer Anstieg der Verdachtsanzeigen/Anerkennungen im eigenen Netzwerk als grober Wirksamkeitsindikator

## Was sich zwischen 1b und 2 technisch ändert (wenig)

- **Stadium 1b**: System-Prompt-Schwerpunkt auf `unfallversicherung-mde.md` + `postcovid-mecfs.md` (MdE-Teil), Eingangsfrage ergänzt um "Ist Ihre BK-3101 bereits anerkannt?" als zusätzliches Gate neben der bestehenden Diagnose-Frage.
- **Stadium 2**: Schwerpunkt verschiebt sich auf `versmedv-gdb-gds.md`, `nervensystem-psyche-herz-gdb.md`, `neurologie-vergleichsfaelle.md` — die für Stadium 1b gebauten Referenzdateien bleiben nutzbar (Gesamt-GdB-Prinzip, Kalibrierungsanker gelten unverändert für beide).
- Interview-Flow, Zeitbudget-Logik, Referenzen-Button, No-Storage-Prinzip, Krisensicherheit: unverändert für 1b und 2. Für 1a gilt das nicht — siehe oben, anderes Produkt.

## Kurzfazit

Drei Bausteine, kein starres Nacheinander: **1a (Ärzte-Domino)** ist vermutlich der wirksamste und am schnellsten baubare Einstieg — rechtlich sauber (Aufklärung über bestehende Pflicht), hoher Hebel pro erreichter Person, dein eigenes Netzwerk als Vertriebsweg. **1b (Patienten-MdE)** profitiert vom wachsenden Fallpool aus 1a und ist bereits als Prototyp vorhanden, mit der wichtigen Einschränkung auf bereits anerkannte BK-3101-Fälle. **2 (GdB)** bleibt der große spätere Hebel für die breite Zielgruppe. 1a und 1b können parallel laufen, da sie unterschiedliche Zielgruppen und unterschiedlichen Bauaufwand haben.
