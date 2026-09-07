# BASTET

KI-gestütztes Orientierungswerkzeug für Post-COVID-/ME-CFS-Betroffene im deutschen Sozialrecht. Zwei Arme (Betroffene und Ärzt:innen), eine gemeinsame Wissensbasis. © Schmitz & Hugenberg, Osnabrück — siehe [`NOTICE.md`](./NOTICE.md) für den vollständigen rechtlichen Rahmen (Haftungsausschluss, Urheberrecht, Open-Source-Einordnung).

**Live:** [bastet-covid.org](https://bastet-covid.org) (Betroffenen-Arm) · [doc.bastet-covid.org](https://doc.bastet-covid.org) bzw. `/doc` (Ärzte-Arm) · Telegram-Bot [@Bastetcovidbot](https://t.me/Bastetcovidbot) (Betroffenen-Arm)

## Die App

Next.js-App (App Router, TypeScript), auf Vercel deployt. Alle drei Kanäle rufen dieselbe serverseitige Interviewlogik auf — der Anthropic-API-Key bleibt auf dem Server, nie im Client. Die Wissensbasis wird vollständig aus dem `de-begutachtung`-Claude-Skill gezogen, nicht mehr aus den handkuratierten Kurzfassungen der ursprünglichen Prototypen.

```
middleware.ts             # doc.bastet-covid.org -> intern /doc, Hauptdomain unverändert
vercel.json                # Cron-Schedule für die Update-Pipeline (wöchentlich, Montag 06:00 UTC)
app/
├── page.tsx              # Betroffenen-Arm, Web-UI (Chat-Interview)
├── doc/page.tsx           # Ärzte-Arm (strukturiertes CCC-Formular)
├── layout.tsx             # gemeinsames Layout inkl. BASTET-Kopfzeile
└── api/
    ├── chat/route.ts      # POST — Betroffenen-Arm-Logik (Web)
    ├── doc/route.ts       # POST — Ärzte-Arm-Logik
    ├── telegram/route.ts  # POST — Telegram-Webhook, ruft dieselbe runInterview()-Logik wie chat/route.ts auf
    ├── premium/route.ts   # POST — x402-geschützter Endpoint (0,10 USDC), liefert PDF-Zusammenfassung
    └── cron/check-updates/route.ts  # GET, per CRON_SECRET geschützt — wöchentlicher Quellen-Check (Phase 4)
scripts/
└── register-agent.ts      # Einmaliges ERC-8004-Registrierungsscript, lokal ausführen (npm run register-agent)
lib/
├── anthropic.ts           # Claude-API-Client (serverseitig)
├── x402.ts                 # x402-Resource-Server-Konfiguration (Facilitator, Celo Mainnet, Agent-Wallet)
├── chat.ts / doc.ts       # System-Prompts + Interviewlogik je Arm
├── content.ts              # Titel/Untertitel/Über-BASTET/Krisenhinweis — von Web und Telegram geteilt
├── format.ts               # REFERENZEN-Block-Parsing, STATS-Trailer-Stripping — von Web und Telegram geteilt
├── telegram.ts             # Telegram sendMessage-Helper (chunkt Nachrichten >3800 Zeichen)
├── telegramSession.ts      # Upstash-Redis-Session pro chat_id, TTL 60 Min. Inaktivität
├── adminCommands.ts        # Telegram-Freigabe-Workflow (/pending, freigeben/ablehnen), nur TELEGRAM_ADMIN_CHAT_ID
├── updateSources.ts        # Quellen-Definitionen + Change-Detection (RSS für BSG, Hash-Fallback sonst)
├── updateSummary.ts        # LLM-Zusammenfassung eines erkannten Funds
├── reviewQueue.ts          # Upstash-backed Pending-Queue, Log, freigegebene Aktualisierungen
├── knowledgeBase.ts        # lädt lib/knowledge/*.md + freigegebene Aktualisierungen (lib/reviewQueue.ts) zur Laufzeit
└── knowledge/*.md          # 1:1 aus skill/de-begutachtung.skill entpackt
```

**Lokal starten:**
```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

**Auf Vercel — Environment Variables:**
- `ANTHROPIC_API_KEY` — sonst antworten `/api/chat` und `/api/doc` mit einem Konfigurationsfehler.
- `TELEGRAM_BOT_TOKEN` — Bot-Token von @BotFather.
- `UPSTASH_REDIS_KV_REST_API_URL` / `UPSTASH_REDIS_KV_REST_API_TOKEN` — über Vercel Storage → Marketplace → Upstash (Redis) provisionieren und mit dem Projekt verbinden. **Achtung bei eigenem Custom-Prefix**: die Vercel-Integration legt je nach gewähltem Prefix andere Variablennamen an als Upstashs eigene Konvention (`UPSTASH_REDIS_REST_URL`/`_TOKEN`) — `lib/telegramSession.ts` liest die Werte deshalb explizit unter den oben genannten Namen, nicht über `Redis.fromEnv()`. Nach dem Verbinden im Dashboard nachsehen, welche Namen tatsächlich entstanden sind. Vercel KV (das native Produkt) wurde Ende 2024 eingestellt.
- `AGENT_WALLET_ADDRESS` (optional) — die BASTET-Agent-Wallet, öffentliche Adresse, Default in `lib/x402.ts` bereits gesetzt (`0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608`). Nur als `payTo` in `/api/premium` verwendet, keine Zahlungspflicht für Web/Telegram.
- `X402_FACILITATOR_URL` (optional) — Default `https://x402.celo.org`.

**`.npmrc` mit `legacy-peer-deps=true`**: `@x402/next` 2.x pinnt `next: ">=16.2.6"` als Peer, verwendet aber ausschließlich die seit Next 15 stabile `next/server`-API (`NextRequest`/`NextResponse`) — der Pin ist konservativer als die tatsächliche Kompatibilität. Ohne `.npmrc` bricht `npm install` (auch auf Vercel) mit `ERESOLVE` ab.

**Domain `doc.bastet-covid.org`**: unter Vercel → Settings → Domains zum Projekt `bastet` hinzufügen (nicht `www.doc...`). Da Vercel auch Registrar von `bastet-covid.org` ist, sollte der DNS-Eintrag automatisch entstehen.

**Telegram-Webhook setzen**, sobald der Code deployt und die drei Variablen oben gesetzt sind — **unbedingt die `www.`-Domain verwenden**, nicht die Apex-Domain: `bastet-covid.org` liefert einen 308-Redirect auf `www.bastet-covid.org`, und Telegrams Webhook-Zustellung folgt Redirects auf POST-Requests nicht — die Domain sähe dann "gesetzt" aus, aber es käme nie eine Nachricht an:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://www.bastet-covid.org/api/telegram"
```
`<TELEGRAM_BOT_TOKEN>` durch den echten Token ersetzen — nie im Klartext committen oder in einen Chat einfügen.

Datenschutz-Hinweis: Der Telegram-Arm ist kein reines No-Storage mehr wie der Web-Arm — der Gesprächsverlauf wird pro `chat_id` in Upstash Redis zwischengespeichert, mit TTL 60 Minuten Inaktivität. Der Bot weist beim Start explizit darauf hin (siehe `GATE_PROMPT` in `app/api/telegram/route.ts`).

**Befehle für alle (nicht nur Admin):** `/about` (Rechtliches, wie der Web-Toggle), `/whoami` (eigene chat_id, z.B. für `TELEGRAM_ADMIN_CHAT_ID`), `/neu` bzw. `/reset` (Gespräch sofort neu starten, statt die 60-Minuten-TTL abzuwarten — Web-Pendant ist ein Seiten-Reload).

### Update-Pipeline (Phase 4) — Wissensbasis mit Human-Review

Ein wöchentlicher Vercel Cron (`vercel.json`, Montag 06:00 UTC) prüft fünf Quellen (BSG, sozialgerichtsbarkeit.de, DGUV, AWMF-Register, VersMedV-Volltext auf gesetze-im-internet.de) auf Änderungen. Für BSG per RSS-Feed (verifiziert, eigener bsg.bund.de-Feed statt des juris.de-Mirrors — letzterer verlangt eine TLS-Renegotiation, die Node/Vercel ablehnt), für die anderen vier per Content-Hash der jeweiligen Seite — bewusst kein Autopublish: ein Fund landet nur in einer Review-Queue (Upstash) und wird per Telegram an `TELEGRAM_ADMIN_CHAT_ID` gemeldet. Erst nach expliziter Freigabe im Chat wird er Teil der Wissensbasis.

**Akzeptierte Lücke: VersMedV-Quelle (5. Slot) schlägt planmäßig fehl.** Ursprünglich REHADAT vorgesehen, blockierte aber Vercels IPs per WAF mit dauerhaftem 503. Ersatz gesetze-im-internet.de (die ohnehin autoritativere Primärquelle direkt beim BMJ) ist TLS-seitig erreichbar, scheitert von Vercel aus aber reproduzierbar an einem reinen TCP-Verbindungstimeout — wahrscheinlich dasselbe Cloud-IP-Blocking-Muster wie bei REHADAT, nur als Timeout statt 503. Nach zwei erfolglosen Quellenwechseln am 06.09.2026 bewusst nicht weiter verfolgt (Entscheidung: Option 1 statt weiterer Quellenjagd) — VersMedV-Novellierungen sind ohnehin selten (zuletzt Teil A grundlegend zum 03.10.2025 geändert), der wöchentliche Fehlschlag dieser einen Quelle beeinträchtigt die anderen vier nicht (jede Quelle ist einzeln try/catch-isoliert, siehe `app/api/cron/check-updates/route.ts`). Novellierungen müssen bis auf Weiteres anderweitig mitverfolgt werden (z.B. Fachpresse).

**Zusätzliche Environment Variables dafür:**
- `CRON_SECRET` — beliebiger langer Zufallsstring, schützt `/api/cron/check-updates` vor fremdem Aufruf (Vercel sendet ihn automatisch als `Authorization: Bearer <CRON_SECRET>` bei geplanten Cron-Aufrufen).
- `TELEGRAM_ADMIN_CHAT_ID` — deine eigene Telegram-chat_id. Ermitteln: dem Bot `/whoami` schreiben.

**Freigabe-Workflow im Telegram-Chat** (nur von der Admin-chat_id aus nutzbar):
- `/pending` — offene Funde auflisten
- `freigeben <id>` (oder nur `freigeben`, falls genau ein Fund offen ist) — übernimmt die Zusammenfassung in die Wissensbasis (sofort wirksam für alle drei Arme, kein Redeploy nötig)
- `ablehnen <id> [Grund]` — verwirft den Fund, bleibt mit Datum und Begründung im Log (`lib/reviewQueue.ts`, nichts wird stillschweigend gelöscht)

**Wie freigegebene Updates aktuell gespeichert werden**: als Liste in Upstash Redis (`lib/reviewQueue.ts`), von `getKnowledgeBase()` bei jeder Anfrage angehängt — bewusst kein Schreibzugriff aufs Git-Repo, um keinen GitHub-Token mit Schreibrechten als Secret zu benötigen. Das ist eine bewusste Zwischenlösung für die Testphase; ein späterer Wechsel zu echten Commits in `lib/knowledge/*.md` (und damit einem "richtigen" Deploy pro Freigabe) ist vorgesehen, aber noch nicht umgesetzt.

**Bekannte Einschränkung**: Die Quellen-URLs für DGUV und AWMF wurden nur auf Erreichbarkeit (HTTP 200) geprüft, nicht auf die exakt richtige Unterseite — ihre RSS-Verfügbarkeit bzw. Datumsfeld-Struktur ließ sich nicht automatisiert verifizieren (SPA-Rendering bzw. keine robots-freundliche Struktur). Ein Hash-Treffer erkennt zuverlässig *irgendeine* Änderung der Seite, auch rein kosmetische — das ist die in der Planung benannte Einschränkung dieses Fallback-Verfahrens. Nach dem ersten echten Fund prüfen, ob die URLs noch die richtigen sind.

**ERC-8004 / x402 (Phasen 3–4, siehe `build/claude-code-buildplan.md`)**: Code steht, aber noch nichts on-chain ausgeführt.
- `scripts/register-agent.ts` — einmaliges Registrierungsscript für die ERC-8004 Identity Registry auf Celo Mainnet (`viem`, `data:`-URI-Metadaten). Lokal ausführen, **nie** in einer gehosteten Session mit echtem Private Key:
  ```bash
  AGENT_PRIVATE_KEY=0x... npm run register-agent
  ```
  Gibt am Ende `agentId` und die passende `https://www.8004scan.io/agents/celo/<id>`-URL für die Celo-Builders-Submission aus. Registry-Adresse/ABI stammen aus dem Build-Plan und sind **vor dem Ausführen mit echtem Geld** gegen `docs.celo.org` bzw. `github.com/celo-org/agent-skills` zu prüfen — von dieser Session aus war das nicht möglich (Netzwerk-Policy blockiert `docs.celo.org`, `forno.celo.org`, `8004scan.io`).
- `app/api/premium/route.ts` + `lib/x402.ts` — x402-geschützter Endpoint (`@x402/next` v2, 0,10 USDC, Celo Mainnet `eip155:42220`, `payTo` = Agent-Wallet). Nimmt eine bereits erzeugte Auswertung entgegen und liefert sie als PDF mit vollständigen Referenzen zurück. Nicht beworben, Web/Telegram/Doc-Arm bleiben kostenfrei.
- **Celo-Builders-Submission**: noch nicht ausgeführt — `celobuilders.xyz` war von dieser Session aus ebenfalls nicht erreichbar (Netzwerk-Policy). Muss aus einer Umgebung mit Netzwerkzugriff (lokal oder eine Session ohne diese Einschränkung) über den `celo-builders`-Skill nachgeholt werden.

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
