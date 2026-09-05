# BASTET — Build-Plan für Claude Code

Dieses Dokument ist so geschrieben, dass es 1:1 als Arbeitsauftrag an Claude Code weitergegeben werden kann. Reihenfolge ist verbindlich — spätere Schritte hängen von früheren ab.

## Ziel
Ein **Vercel-Projekt** (Next.js, App Router mit API Routes), das die BASTET-Interviewlogik über drei Kanäle bereitstellt (Web, Telegram, x402-Premium-Endpoint), plus ERC-8004-Registrierung und Celo-Builders-Submission. Repo: **`frerehugi/BASTET`** (bereits angelegt). Domain: **`bastet-covid.org`** (bereits registriert, Registrar Vercel, Laufzeit bis 05.09.2027).

**Korrektur gegenüber der ersten Fassung**: Ursprünglich war ein Cloudflare Worker vorgesehen, in Analogie zu einer angenommenen OSIRIS/APIS-Infrastruktur. Ein Blick in das tatsächliche APIS-Vercel-Projekt zeigt: **APIS läuft auf Vercel**, nicht auf einem Cloudflare Worker. Dieser Plan folgt jetzt dem tatsächlichen, bestätigten Stack der Projektfamilie statt einer falschen Annahme.

**Einordnung des Hackathons**: "Agents at Work" ist wie ein **Audit**, nicht ein Marketing-Event — der Prozess selbst (öffentliches Repo, on-chain überprüfbare ERC-8004-Registrierung, verifizierbare x402-Zahlungen) erzwingt eine externe technische Kontrolle, die es sonst nicht gäbe: Funktioniert das System wirklich, unter echten Randbedingungen, nachvollziehbar für Dritte? Konsequenz für die Priorisierung: ein tatsächlich funktionierendes, extern verifizierbares System hat Vorrang vor Submission-Politur (Tagline, Demo-Video, Pitch) — Phase 6 darf schlank bleiben, wenn die Zeit knapp wird, Phase 1–5 (die eigentliche Funktionsfähigkeit, die dem Audit standhält) nicht.

## Bezug zu OSIRIS/APIS — Wiederverwendung statt Neuaufbau

BASTET ist ein **zweites, separates Hackathon-Projekt** — eigenes Repo, eigene Celo-Builders-Submission, eigener Track, unabhängig von APIS (das bereits mit Track 2 "Real World Adoption" für "Agents at Work" registriert ist). Kein Merge, keine gemeinsame Submission.

Trotzdem lässt sich einiges direkt übernehmen, statt neu zu recherchieren:
- **Stack-Muster**: Solidity + React/TypeScript, öffentliches GitHub-Repo, Live-Domain, "built with Claude Code" — wie bei OSIRIS/APIS, spart Setup-Entscheidungen.
- **ERC-8004-Vorarbeit aus APIS**: Dort ist die Frage, ob ein Agent als discoverable Identity registriert oder eher intern zur Sub-Agent-Validierung genutzt wird, bereits durchdacht — für BASTET ist die Antwort klar (discoverable Identity, siehe Phase 3), das spart die Grundsatzdiskussion.
- **Bekannter Referenz-Skill-Repo**: `github.com/celo-org/agent-skills` (Apache-2.0, 8004- und x402-Skills) ist aus der APIS-Arbeit bereits bekannt — direkt nutzbar, keine neue Recherche nötig.
- **MiniPay-Erfahrung** (Fee-Abstraction, QR-Code-Verhalten) aus OSIRIS ist vorhanden, falls BASTET später einen MiniPay-Zugang bekommen soll — nicht Teil dieses Plans, aber ein möglicher späterer Baustein ohne Lernkurve.

**Zeitaufteilung geklärt**: APIS braucht in diesem Fenster nur eine Keeper-Aktualisierung — kein größerer Aufwand. Der Fokus der verfügbaren Zeit liegt auf BASTET, der Build-Plan kann entsprechend ambitioniert verfolgt werden.

## Voraussetzungen (vom Menschen zu liefern, bevor Claude Code startet)
- [x] GitHub-Repo `frerehugi/BASTET` — bereits angelegt
- [x] Domain `bastet-covid.org` — bereits registriert (Vercel, Auto-Renewal an, $10.99/Jahr)
- [ ] Vercel-Projekt für `frerehugi/BASTET` anlegen und mit `bastet-covid.org` verbinden (Domain ist registriert, aber laut Dashboard noch mit keinem Projekt verbunden — "No projects on this team are using this domain")
- [ ] Anthropic API-Key
- [ ] Neue Celo-Wallet: Adresse + Private Key (separat, nur als Secret, nie im Repo)
- [ ] Wallet mit ein paar Cent CELO für Gas befüllt
- [ ] Telegram-Bot-Token von @BotFather
- [ ] x402.celo.org Dashboard-Account (Wallet verbinden, API-Key holen)
- [ ] Vercel KV (oder Upstash Redis über Vercel Marketplace) für die Telegram-Session — siehe Phase 5

## Repo-Struktur (Zielzustand)

```
BASTET/
├── app/
│   ├── api/
│   │   ├── chat/route.ts       # POST /api/chat — Betroffenen-Arm (Web-Frontend)
│   │   ├── doc/route.ts         # POST /api/doc — Ärzte-Arm (Web-Frontend)
│   │   ├── telegram/route.ts    # POST /api/telegram — Webhook-Handler (Betroffenen-Arm)
│   │   └── premium/route.ts     # POST /api/premium — x402-geschützter Endpoint
│   ├── page.tsx                  # Betroffenen-Arm, Web-UI (aus vorbegutachtung-prototyp.jsx portiert)
│   ├── doc/page.tsx              # Ärzte-Arm, Web-UI (aus co-bgutachtung-doc-prototyp.jsx portiert)
│   └── layout.tsx                # gemeinsames Layout inkl. BASTET-Kopfzeile (topBar)
├── lib/
│   ├── chat.ts                   # Kern: Interview-/Auswertungslogik Betroffenen-Arm
│   ├── doc.ts                     # Kern: Formular-/Auswertungslogik Ärzte-Arm
│   ├── knowledgeBase.ts          # Kondensierte Wissensbasis (aus Skill-Referenzdateien) — von beiden Armen geteilt
│   ├── x402.ts                    # Facilitator-Integration
│   ├── telegram-api.ts           # sendMessage-Helper
│   └── stats.ts                   # Anonyme Aggregat-Statistik (GdB/MdE-Buckets), kein Personenbezug
├── public/
│   ├── assets/
│   │   ├── bastet-badge.png       # kleines rundes Emblem (512×512), Kopfzeile auf jeder Seite — siehe Abschnitt "Markenbild"
│   │   ├── favicon.ico             # aus bastet-badge.png generiert (mehrere Größen: 16/32/48px)
│   │   └── icon-192.png, icon-512.png  # PWA-Icons, aus bastet-badge.png skaliert
│   └── manifest.webmanifest        # PWA-Manifest, siehe Abschnitt "Markenbild"
├── scripts/
│   └── register-agent.ts      # Einmaliges ERC-8004-Registrierungsscript
├── vercel.json                 # optional, i. d. R. reichen Vercel-Defaults für Next.js
├── package.json
├── .gitignore                  # .env*, *.key NIE einchecken
├── LICENSE                     # Alle Rechte vorbehalten (Standard) — öffentliche Einsehbarkeit ≠ Lizenzvergabe, siehe NOTICE.md
├── NOTICE.md                   # Haftungsausschluss + Urheberrecht (Volltext, siehe bastet-haftungsausschluss-urheberrecht.md) — Name, Marke und redaktionelle Inhalte bleiben "alle Rechte vorbehalten" bei Schmitz & Hugenberg, unabhängig von der Code-Lizenz
└── README.md                   # Kurzbeschreibung für die Hackathon-Bewertung, verlinkt NOTICE.md
```

## Markenbild: BASTET-Emblem konsistent einsetzen

Das Emblem (rundes Katzen-Medaillon, Grün/Gold) ist im Gesamtordner unter `assets/bastet-badge.png` und `assets/bastet-badge-full.png` (unbeschnittene Vollversion mit Schriftzug) enthalten. Verwendung:

- **In beiden Web-Frontends** (Betroffenen-Arm, Ärzte-Arm): feste, dunkle Kopfzeile über jeder Seite/jedem Zustand mit Badge + "BASTET"-Schriftzug — bereits so in beiden Prototypen umgesetzt (`BASTET_BADGE`-Konstante, `topBar`-Styles). Beim Portieren in die Next.js-App (`app/layout.tsx`) 1:1 übernehmen, nicht neu erfinden.
- **Favicon**: aus `bastet-badge.png` per Tool (z. B. `sharp` oder `favicons`-npm-Paket) ein `favicon.ico` mit den Standardgrößen generieren.
- **PWA-Manifest** (`public/manifest.webmanifest`), damit "Zum Startbildschirm hinzufügen" ein echtes App-Icon zeigt:
```json
{
  "name": "BASTET",
  "short_name": "BASTET",
  "icons": [
    { "src": "/assets/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/assets/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#1F3D2E",
  "background_color": "#1F3D2E",
  "display": "standalone",
  "start_url": "/"
}
```
- **Telegram-Bot-Profilbild**: `bastet-badge.png` beim Anlegen des Bots über @BotFather (`/setuserpic`) hochladen — gleiches Bild, keine Neugestaltung.

**Rechte-Hinweis**: Das Emblem fällt unter dieselbe "alle Rechte vorbehalten"-Regel wie Name und Marke (siehe `NOTICE.md`) — Verwendung innerhalb des Projekts ist selbstverständlich vorgesehen, aber die Bilddatei selbst folgt nicht der Quellcode-Offenlegung.

## Aufgabenliste in Reihenfolge

### Phase 1 — Next.js-Fundament (beide Arme)
1. `frerehugi/BASTET` klonen, `npx create-next-app@latest` (App Router, TypeScript) sofern noch nicht initialisiert, sonst bestehende Struktur übernehmen
2. `app/api/chat/route.ts` und `app/api/doc/route.ts`: Next.js Route Handler (`export async function POST(req: Request)`), rufen die jeweilige Kernfunktion auf
3. `lib/chat.ts`: Kernfunktion `runInterview(messages, diagnosisConfirmed)` — Betroffenen-Arm, Logik 1:1 aus dem bestehenden React-Prototyp (`buildSystemPrompt`, Turn-Budget, Referenzen-Format) portieren, nur ohne React-State — reine Funktion, die History rein- und Antwort rausgibt
4. `lib/doc.ts`: Kernfunktion `runDocAssessment(structuredInput, diagnosisCertain)` — Ärzte-Arm, Logik 1:1 aus dem Doc-Prototyp portiert (strukturierter CCC-Input statt Chat-History, gleiches GdB+MdE-Pflicht-Format, gleiches Referenzen-Prinzip)
5. `lib/knowledgeBase.ts`: Wissensbasis aus den Skill-Referenzdateien (`versmedv-gdb-gds.md`, `postcovid-mecfs.md`, `nervensystem-psyche-herz-gdb.md`, `neurologie-vergleichsfaelle.md`, `schmerz-neuro-kardio-erweiterung.md`, `ccc-fragenkatalog-kalibrierung.md`, `unfallversicherung-mde.md`) als strukturierte Konstante, von `lib/chat.ts` und `lib/doc.ts` gemeinsam importiert — Inhalte sind bereits fertig recherchiert, nur noch ins passende Format bringen
6. `POST /api/chat`: nimmt `{messages: [...], diagnosisConfirmed: boolean}`, ruft `runInterview` auf
7. `POST /api/doc`: nimmt `{structuredInput: {...}, diagnosisCertain: boolean}`, ruft `runDocAssessment` auf
8. Für beide: **kein** serverseitiges Speichern der Eingaben (No-Storage-Prinzip bleibt bestehen) — Next.js Route Handler sind zustandslos por Request, das passt von Haus aus dazu
9. Lokal testen (`vercel dev` bzw. `npm run dev`), dann per Git-Push auf `main` automatisch deployen (Vercel-Standardverhalten) oder `vercel --prod`

### Phase 2 — Web-Frontends umstellen
10. Beide bestehenden React-Prototypen (Betroffenen-Arm und Doc-Arm) als `app/page.tsx` bzw. `app/doc/page.tsx` einbetten, so angepasst, dass sie `POST /api/chat` bzw. `POST /api/doc` aufrufen statt direkt `api.anthropic.com` — Anthropic-Key wandert vom Client in die Route Handler (Vercel Environment Variable `ANTHROPIC_API_KEY`, im Dashboard oder via `vercel env add`)
11. Domain verbinden: im Vercel-Projekt unter **Settings → Domains** `bastet-covid.org` hinzufügen (Domain existiert bereits, ist aber laut Screenshot noch keinem Projekt zugeordnet — das ist der erste sichtbare Schritt)

### Phase 3 — ERC-8004

**Priorität bestätigt**: Die 8004-Registrierung als eigenständige On-Chain-Identität ist wichtiger als der Zahlungsweg — auch weil sie in vergleichbaren früheren Celo-Agent-Hackathons durchgehend zentral für die Bewertung war (teils sogar direktes Gewinnkriterium: "höchster 8004-Reputationsscore gewinnt"). Diese Phase hat entsprechend Vorrang vor Phase 4.

11. `scripts/register-agent.ts`: Registrierungsscript wie im Hackathon-Plan skizziert (viem, `data:`-URI-Metadaten, Identity Registry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` auf Celo Mainnet) — eine Agent-Identität für das Gesamtprodukt, beide Arme werden in den `services` der Metadaten als getrennte Endpoints (`/chat`, `/doc`) aufgeführt
12. Einmalig lokal ausführen (braucht den Private Key als lokale Env-Variable, **nicht** committen), agentId notieren
13. `erc8004Url` (z. B. `https://www.8004scan.io/agents/celo/<id>`) für die spätere Submission vormerken
14. **Nutzungs-Zähler statt Zahlungspflicht**: Da die Aufrufzahl wichtiger ist als Umsatz, optional einen leichtgewichtigen On-Chain-Zähler ergänzen — bei jeder abgeschlossenen Interaktion (Web/Telegram) eine minimale, kostenlose Transaktion mit dem `attributionTag` senden (reines Log/Ping, kein Zahlungsfluss), macht die Nutzungszahl nachweisbar, ohne x402 vorauszusetzen. Nur sinnvoll, wenn die Gas-Kosten dafür vernachlässigbar bleiben — vor dem Bauen kurz gegenrechnen (Celo-Gas ist niedrig, aber bei sehr vielen Aufrufen trotzdem gegenprüfen).

### Phase 4 — x402

**Einordnung**: Diese Infrastruktur wird jetzt gebaut, aber **ohne ökonomischen Druck** — kein aktives Monetarisierungsziel, keine Vermarktung eines "Premium"-Features gegenüber Nutzer:innen. Zweck ist, die Struktur zu hinterlegen: einmal für den Hackathon-Nachweis (verifizierbarer, funktionierender x402-Zahlungskanal), einmal als spätere Option, falls Unternehmen, Versicherungen oder Privatpersonen das System einmal finanziell unterstützen möchten. Der Patient:innen- und Ärzte-Arm bleiben vollständig kostenfrei und offen — das ändert sich durch diese Phase nicht.

11. Vor dem Coden: `https://x402.celo.org/SKILL.md` live abrufen (aktuellste Version des Integrationscodes — nicht aus diesem Dokument kopieren, das veraltet)
12. `app/api/premium/route.ts`: ein Endpoint "PDF-Zusammenfassung mit vollständigen Referenzen", 402-Response mit Preis-Objekt (USDC, 6 Dezimalstellen, `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`), Verifikation/Settlement über den gehosteten Facilitator — funktionsfähig und nachweisbar, aber bewusst nicht beworben oder in den UI-Flow gedrängt
13. `payTo` = die in Phase 3 registrierte Agent-Wallet-Adresse
14. API-Key vom x402-Dashboard als Vercel Environment Variable hinterlegen (`vercel env add X402_API_KEY` oder im Dashboard)

### Phase 5 — Telegram
15. Webhook setzen: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://bastet-covid.org/api/telegram`
16. **Korrektur gegenüber der ersten Skizze**: Telegram liefert im Webhook-Modus nur die jeweils neue Nachricht, keinen Verlauf — `getUpdates` ist zudem exklusiv zu Webhooks. Für ein Mehrschritt-Interview braucht es einen flüchtigen Zwischenspeicher pro `chat_id` in **Vercel KV** (Redis-kompatibel, über Vercel Marketplace/Upstash-Integration) mit TTL (z. B. 60 Min. Inaktivität → Auto-Löschung). Das ist kein reines No-Storage mehr, aber auch keine dauerhafte Speicherung — im Datenschutzhinweis entsprechend transparent machen ("Ihr Gesprächsverlauf wird für die Dauer der aktiven Unterhaltung zwischengespeichert und nach 60 Minuten Inaktivität automatisch gelöscht").
17. `app/api/telegram/route.ts` (Entwurf, so an Claude Code übergebbar):

```ts
// app/api/telegram/route.ts
import { kv } from "@vercel/kv"; // oder Upstash-Client, je nach gewählter Integration
import { runInterview } from "@/lib/chat";

const SESSION_TTL_SECONDS = 60 * 60; // 60 Minuten Inaktivität -> Auto-Löschung

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

interface StoredSession {
  messages: { role: "user" | "assistant"; content: string }[];
  diagnosisConfirmed: boolean | null;
}

export async function POST(request: Request): Promise<Response> {
  const update: TelegramUpdate = await request.json();
  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();
  const token = process.env.TELEGRAM_BOT_TOKEN!;

  if (!chatId || !text) {
    return new Response("ok"); // Telegram erwartet 200, auch bei Nicht-Text-Updates
  }

  const sessionKey = `tg:${chatId}`;
  const existing = await kv.get<StoredSession>(sessionKey);
  const session: StoredSession = existing ?? { messages: [], diagnosisConfirmed: null };

  // Diagnose-Gate als erste Interaktion, analog zum Web-Interface
  if (session.diagnosisConfirmed === null) {
    if (/^ja\b/i.test(text)) {
      session.diagnosisConfirmed = true;
    } else if (/^(nein|unklar)/i.test(text)) {
      session.diagnosisConfirmed = false;
    } else {
      await sendTelegramMessage(
        token,
        chatId,
        "Bevor wir starten: Dieser Chat wird nur für die Dauer der Unterhaltung zwischengespeichert und nach 60 Minuten Inaktivität automatisch gelöscht.\n\nIst bei Ihnen ein Post-COVID-Syndrom bzw. ME/CFS bereits ärztlich diagnostiziert bzw. gesichert? (ja / nein)"
      );
      await kv.set(sessionKey, session, { ex: SESSION_TTL_SECONDS });
      return new Response("ok");
    }
  }

  session.messages.push({ role: "user", content: text });

  const { body, refs, stats } = await runInterview(session.messages, session.diagnosisConfirmed);
  session.messages.push({ role: "assistant", content: body });

  await kv.set(sessionKey, session, { ex: SESSION_TTL_SECONDS });

  await sendTelegramMessage(token, chatId, body);
  if (refs && refs.length > 0) {
    await sendTelegramMessage(
      token,
      chatId,
      "📚 Referenzen:\n" + refs.map((r) => `${r}`).join("\n")
    );
  }
  if (stats) {
    await recordAnonymousStats(stats); // siehe Phase 7 — fire-and-forget, kein Bezug zur chat_id
  }

  return new Response("ok");
}

async function sendTelegramMessage(token: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}
```

18. `runInterview` in `lib/chat.ts` muss dafür so erweitert werden, dass sie neben `{body, refs}` auch `stats` zurückgibt (siehe Phase 7) — einmal implementieren, von Web/Doc/Telegram gleichermaßen genutzt.
19. Formatierung: kein natives Ein-/Ausklappen in Telegram — Referenzen als zweite Nachricht, wie im Code oben.

### Phase 6 — Celo Builders Submission
20. `celo-builders`-Skill nutzen: Hackathon-Slug bestätigen, `/submission-fields` abrufen — **wichtig**: das ist auch der Moment, an dem sich definitiv klärt, ob x402/8004-Felder für "Agents at Work" tatsächlich `required` sind oder nur `optional`/track-abhängig. Aus dem Chat heraus ließ sich das nicht abschließend verifizieren (Tool-Einschränkung, kein Netzwerkzugriff auf celobuilders.xyz) — Claude Code hat beim Bauen echten Zugriff und sollte das Ergebnis kurz zurückmelden, bevor Phase 4 (x402) vertieft wird.
21. Google-Login-Flow durchlaufen (Mensch öffnet den Link, gibt den Code zurück)
22. Früh registrieren: `projectName: "BASTET"`, `githubUrl`, `trackIds`
23. `agentWalletAddress` und `erc8004Url` nachtragen, sobald Phase 3 fertig ist
24. Öffentliches Repo pushen (Mensch macht das, oder gibt Claude Code Schreibzugriff)
25. Submission vervollständigen (Tagline, Beschreibung, Demo-URL, ggf. Video), **erst nach Freigabe** `publish`

### Phase 7 — Anonyme Datenerhebung (GdB/MdE-Ergebnisse, kein Gesprächsinhalt)

Ziel: aggregierte Statistik, wie viele Einschätzungen zu welchen GdB-/MdE-Bereichen führen, aufgeschlüsselt danach, ob ein beruflich bedingtes Post-COVID/ME-CFS gesichert ist — **ohne** Gesprächsinhalt, ohne Namen, ohne Zuordnung zu `chat_id`/Session.

26. **Struktiertes Statistik-Trailer-Format**, analog zum REFERENZEN-Block, aber vom Server verarbeitet und **nie an den Client/Telegram weitergegeben**: Das Modell hängt an jede Auswertungsnachricht einen maschinenlesbaren Block an:
```
STATS: beruflich_bedingt_gesichert=ja|nein|unklar; gdb_von=NN; gdb_bis=NN; mde_einschlaegig=ja|nein; mde_von=NN; mde_bis=NN
```
27. `lib/chat.ts`/`lib/doc.ts`: nach Erhalt der Modellantwort den `STATS:`-Block per Regex extrahieren, aus dem an Nutzer:innen zurückgegebenen Text **entfernen** (weder Web noch Telegram noch Doc-Arm zeigen ihn je an), geparste Werte als `stats`-Objekt zurückgeben.
28. `lib/stats.ts`: `recordAnonymousStats(stats)` — schreibt **nur einen Zähler-Increment** in Vercel KV oder Vercel Postgres, Schlüssel z. B. `stats:{arm}:{beruflich_bedingt_gesichert}:{gdb_bucket}:{mde_bucket}` (Buckets in 10er-Schritten, z. B. "40-49"), Wert = Zähler (`kv.incr(key)`). Kein Datensatz pro Person, keine Zeitstempel-Zuordnung zu einer Konversation, kein Freitext.
29. Auswertung später über `kv.keys("stats:*")` oder eine kleine Postgres-Abfrage — ergibt eine Kreuztabelle "GdB/MdE-Verteilung nach Berufsbezug-Status", ohne dass irgendwo eine einzelne Person rekonstruierbar ist.
30. **Transparenzpflicht**: Datenschutzhinweis in allen drei Frontends ergänzen, z. B. "Zur Weiterentwicklung erfassen wir anonym, in welchen GdB-/MdE-Bereich Einschätzungen fallen und ob ein beruflicher Zusammenhang gesichert ist — niemals den Gesprächsinhalt, niemals mit Ihnen verknüpfbar." Muss vor Live-Gang stehen, nicht nachträglich ergänzt werden.


## Was Claude Code NICHT autonom entscheiden sollte
- Ob die volle Wissensbasis öffentlich einsehbar ins Repo kommt oder als Secret geladen wird (Punkt aus der Geheimhaltungs-Diskussion — Rückfrage an den Menschen)
- Ob für den Code doch eine Lizenz vergeben werden soll (Standard ist "alle Rechte vorbehalten"; öffentliche Einsehbarkeit für die Hackathon-Teilnahme ist davon unabhängig) — Rückfrage an den Menschen, nicht Default von Claude Code
- Wann `publish` auf celobuilders.xyz ausgelöst wird (immer erst nach expliziter Freigabe)
- Ob für den x402-Premium-Endpoint tatsächlich Echtgeld-Zahlungen (Mainnet) oder erst Celo Sepolia zum Testen verwendet werden
- Die TTL für die Telegram-Session (Vorschlag 60 Min. — kürzer ist datenschutzfreundlicher, länger ist nutzerfreundlicher bei Unterbrechungen)
- Die Bucket-Granularität der anonymen Statistik (Vorschlag 10er-Schritte — feiner erlaubt mehr Analyse, gröber schützt besser vor Re-Identifikation bei kleinen Fallzahlen)
- Konkreter Anbieter für Vercel KV (natives Vercel KV vs. Upstash-Redis-Integration über den Vercel Marketplace) — funktional austauschbar, aber unterschiedliche Preismodelle/Limits im Hobby-Tier, kurz prüfen statt blind wählen

## Geschätzter Aufwand
Phasen 1–2 sind der Flaschenhals (neues Backend statt Client-only) — realistisch 1,5–2 Tage. Phasen 3–6 sind danach je einzeln klein (Stunden bis maximal ein Tag). WhatsApp ist bewusst nicht Teil dieses Plans — Telegram deckt den Messenger-Kanal für den Hackathon-Scope ab; WhatsApp kann bei Bedarf später als eigener Baustein nachgezogen werden.

## Nach dem Hackathon: was das Audit nicht abdeckt

Der Hackathon-Prozess prüft technische Funktionsfähigkeit (läuft es, ist es verifizierbar, hält es einer öffentlichen Registrierung stand) — er prüft **nicht** die fachliche Qualität der GdB/MdE-Ausgaben selbst. Das bleibt danach deine Aufgabe: Stichproben-Review der Auswertungen gegen die realen Testfälle aus dieser Konversation (siehe den Physiotherapeut:in-Fall), Belastungstest der Turn-Budget-/Referenzen-/Stats-Logik über mehrere echte Gesprächsverläufe, fachliche Freigabe, bevor an eine echte Nutzung (Ärzte-Netzwerk, Patientenkontakt) zu denken ist. Das eine Audit ersetzt das andere nicht.
