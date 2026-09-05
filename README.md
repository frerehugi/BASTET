# BASTET — Gesamtordner

KI-gestütztes Orientierungswerkzeug für Post-COVID-/ME-CFS-Betroffene im deutschen Sozialrecht. Zwei Arme (Betroffene und Ärzt:innen), eine gemeinsame Wissensbasis. © Schmitz & Hugenberg, Osnabrück — siehe `recht/bastet-haftungsausschluss-urheberrecht.md` für den vollständigen rechtlichen Rahmen (Haftungsausschluss, Urheberrecht, Open-Source-Einordnung).

## Ordnerübersicht

### `skill/`
- **`de-begutachtung.skill`** — die vollständige, kuratierte Wissensbasis als Claude-Skill-Paket: VersMedV-Auszüge, Kanadische Konsenskriterien, MdE/BK-3101-Kausalitätsstufen, Kalibrierungsanker aus realen Gerichtsentscheidungen (Neurologie, Kardiologie, Psychiatrie, Schmerztherapie), CCC-Fragenkatalog. Installierbar über den Save-Button in Claude.

### `prototypen/`
- **`vorbegutachtung-prototyp.jsx`** — Betroffenen-Arm: geführtes Chat-Interview (15-Min-Zeitbudget, Diagnose-Gate, Krisensicherheit, Referenzen-Button, Copy-Funktion, BASTET-Kopfzeile)
- **`co-bgutachtung-doc-prototyp.jsx`** — Ärzte-Arm: strukturiertes CCC-Formular statt Chat, Meldepflicht-Banner (§ 202 SGB VII), gleiche Auswertungslogik
- Beide sind React-Artefakte, direkt in Claude lauffähig (Anthropic-API-Aufruf clientseitig) — für die Produktivversion siehe `build/claude-code-buildplan.md`.

### `strategie/`
- **`zwei-stadien-strategie.md`** — Produktstrategie: Stadium 1a (Ärzte-Domino), 1b (Patienten-MdE), 2 (breiter GdB-Rollout); Kausalitätsstufen-Analyse; Produktstruktur "zwei Arme, eine Engine"
- **`marktanalyse-postcovid-mecfs-bg.md`** — Prävalenzzahlen, BG-Zuständigkeit, Kostenentwicklung, die "Nachlaufwelle"
- **`begutachtungs-agent-architektur.md`** — ursprüngliches Architekturkonzept (ein Backend, mehrere Fronten)
- **`vorbegutachtung-interview-design.md`** — Interaktionsdesign des Betroffenen-Interviews im Detail

### `build/`
- **`claude-code-buildplan.md`** — der zentrale Umsetzungsplan, so an Claude Code übergebbar: Repo-Struktur, Phasen 1–6 (Worker-Fundament, Web-Frontends, ERC-8004, x402, Telegram, Celo-Builders-Submission), Markenbild-Integration (Favicon, PWA-Manifest)
- **`hackathon-listing-plan.md`** — Detailplan zur Celo-"Agents at Work"-Hackathon-Teilnahme

### `recht/`
- **`bastet-haftungsausschluss-urheberrecht.md`** — vollständiger Haftungsausschluss und Urheberrechtshinweis, als Volltext für Repo (`NOTICE.md`) und App-Footer gedacht

### `praesentation/`
- **`bastet-vortrag.pptx`** — 17-Folien-Vortrag für ein akademisches, fachfremdes Publikum (Problem, Institution BG, Größenordnungen, Patientensicht, BASTET-Vorstellung, Limitierungen)
- **`vortrag-bastet.md`** — dazugehöriges Redemanuskript

### `assets/`
- **`bastet-badge.png`** — freigestelltes rundes Emblem (Katzen-Medaillon, ohne Textplatte), Basis für Kopfzeilen-Badge, Favicon, PWA-Icons, Telegram-Bot-Profilbild
- **`bastet-badge-full.jpeg`** — Original-App-Icon-Entwurf mit "BASTET"-Schriftzug
- **`icon-192.png`, `icon-512.png`** — vorskalierte PWA-Icon-Größen

## Empfohlene erste Schritte
1. `skill/de-begutachtung.skill` in Claude installieren (Save-Button)
2. `strategie/zwei-stadien-strategie.md` lesen für den Gesamtüberblick
3. `build/claude-code-buildplan.md` an Claude Code übergeben, sobald die eigentliche Entwicklung beginnt

Stand: September 2026.
