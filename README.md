# BASTET

KI-gestütztes Orientierungswerkzeug für Post-COVID-/ME-CFS-Betroffene im deutschen Sozialrecht. Zwei Arme (Betroffene und Ärzt:innen), eine gemeinsame Wissensbasis. © Schmitz & Hugenberg, Osnabrück — siehe [`NOTICE.md`](./NOTICE.md) für den vollständigen rechtlichen Rahmen (Haftungsausschluss, Urheberrecht, Open-Source-Einordnung).

**Live:** [bastet-covid.org](https://bastet-covid.org) (Betroffenen-Arm) · `/doc` (Ärzte-Arm)

## Die App

Next.js-App (App Router, TypeScript), auf Vercel deployt. Beide Arme rufen serverseitige API-Routen auf — der Anthropic-API-Key bleibt auf dem Server, nie im Client. Die Wissensbasis wird vollständig aus dem `de-begutachtung`-Claude-Skill gezogen, nicht mehr aus den handkuratierten Kurzfassungen der ursprünglichen Prototypen.

```
app/
├── page.tsx              # Betroffenen-Arm (Chat-Interview)
├── doc/page.tsx           # Ärzte-Arm (strukturiertes CCC-Formular)
├── layout.tsx             # gemeinsames Layout inkl. BASTET-Kopfzeile
└── api/
    ├── chat/route.ts      # POST — Betroffenen-Arm-Logik
    └── doc/route.ts       # POST — Ärzte-Arm-Logik
lib/
├── anthropic.ts           # Claude-API-Client (serverseitig)
├── chat.ts / doc.ts       # System-Prompts + Interviewlogik je Arm
├── knowledgeBase.ts        # lädt lib/knowledge/*.md zur Laufzeit
└── knowledge/*.md          # 1:1 aus skill/de-begutachtung.skill entpackt
```

**Lokal starten:**
```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

**Auf Vercel:** `ANTHROPIC_API_KEY` muss unter Project Settings → Environment Variables gesetzt sein, sonst antworten `/api/chat` und `/api/doc` mit einem Konfigurationsfehler.

Noch nicht umgesetzt (siehe `build/claude-code-buildplan.md`, Phasen 3–7): ERC-8004-Registrierung, x402-Premium-Endpoint, Telegram-Bot, anonyme GdB/MdE-Statistik, Celo-Builders-Submission.

## Ordnerübersicht

### `skill/`
- **`de-begutachtung.skill`** — die vollständige, kuratierte Wissensbasis als Claude-Skill-Paket: VersMedV-Auszüge, Kanadische Konsenskriterien, MdE/BK-3101-Kausalitätsstufen, Kalibrierungsanker aus realen Gerichtsentscheidungen (Neurologie, Kardiologie, Psychiatrie, Schmerztherapie), CCC-Fragenkatalog. Installierbar über den Save-Button in Claude.

### `prototypen/`
- **`vorbegutachtung-prototyp.jsx`** — Betroffenen-Arm: geführtes Chat-Interview (15-Min-Zeitbudget, Diagnose-Gate, Krisensicherheit, Referenzen-Button, Copy-Funktion, BASTET-Kopfzeile)
- **`co-bgutachtung-doc-prototyp.jsx`** — Ärzte-Arm: strukturiertes CCC-Formular statt Chat, Meldepflicht-Banner (§ 202 SGB VII), gleiche Auswertungslogik
- Beide sind React-Artefakte, direkt in Claude lauffähig (Anthropic-API-Aufruf clientseitig) — inzwischen nach `app/page.tsx` bzw. `app/doc/page.tsx` portiert (API-Key serverseitig, siehe Abschnitt "Die App" oben). Als eigenständige Referenz/Claude-Artefakte bleiben sie hier erhalten.

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
