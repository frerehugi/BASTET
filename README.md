# BASTET

KI-gestütztes Orientierungswerkzeug für Post-COVID-/ME-CFS-Betroffene im deutschen Sozialrecht. Zwei Arme (Betroffene und Ärzt:innen), eine gemeinsame Wissensbasis. © Schmitz & Hugenberg, Osnabrück — siehe [`NOTICE.md`](./NOTICE.md) für den vollständigen rechtlichen Rahmen (Haftungsausschluss, Urheberrecht, Open-Source-Einordnung).

**Live:** [bastet-covid.org](https://bastet-covid.org) (Betroffenen-Arm) · [doc.bastet-covid.org](https://doc.bastet-covid.org) bzw. `/doc` (Ärzte-Arm) · Telegram-Bot [@Bastetcovidbot](https://t.me/Bastetcovidbot) (Betroffenen-Arm)

## Die App

Next.js-App (App Router, TypeScript), auf Vercel deployt. Alle drei Kanäle rufen dieselbe serverseitige Interviewlogik auf — der Anthropic-API-Key bleibt auf dem Server, nie im Client. Die Wissensbasis wird vollständig aus dem `de-begutachtung`-Claude-Skill gezogen, nicht mehr aus den handkuratierten Kurzfassungen der ursprünglichen Prototypen.

```
middleware.ts             # doc.bastet-covid.org -> intern /doc, Hauptdomain unverändert
vercel.json                # Cron-Schedule für die Update-Pipeline (wöchentlich, Montag 06:00 UTC)
app/
├── page.tsx              # Betroffenen-Arm, Web-UI — formularbasiert, zweistufig (siehe unten), KEIN Freitext-Chat mehr
├── Stage1Form.tsx          # Stufe 1: 8 Fragen, ein Formular
├── Stage2Form.tsx          # Stufe 2: 19 Fragen, gruppiert in Abschnitte, ein Formular
├── FormControls.tsx        # geteilte Eingabe-Bausteine (ChoiceGroup, MultiSelectGroup, SkippableTextArea, YesNoDetail)
├── DetailedAnalysisFlow.tsx  # liefert Stufe 2: direkt (Kill-Switch aus) oder über Stripe Express Checkout Element (Kill-Switch an)
├── doc/page.tsx           # Ärzte-Arm (strukturiertes CCC-Formular, unverändert)
├── layout.tsx             # gemeinsames Layout inkl. BASTET-Kopfzeile
└── api/
    ├── assessment/route.ts           # POST — Stufe 1, immer kostenlos, unabhängig von PAYWALL_ENABLED
    ├── checkout/route.ts             # POST — legt Assessment-Session an + Stripe PaymentIntent (nur erreicht, wenn PAYWALL_ENABLED=true)
    ├── detailed-assessment/route.ts  # POST — Stufe 2. EINZIGER Verzweigungspunkt für PAYWALL_ENABLED (lib/paywall.ts): direkt (aus) oder nur nach webhook-bestätigter Zahlung (an)
    ├── stripe/webhook/route.ts       # POST — Stripe-Webhook, signaturgeprüft, einzige Quelle für "bezahlt"
    ├── stripe/config/route.ts        # GET — liefert STRIPE_PUBLISHABLE_KEY an den Client
    ├── pricing/route.ts              # GET — liefert Detailanalyse-Preis UND PAYWALL_ENABLED-Status an den Client
    ├── doc/route.ts       # POST — Ärzte-Arm-Logik
    ├── telegram/route.ts  # POST — Telegram-Webhook, ruft weiterhin das freie Chat-Interview (runInterview) auf — UNVERÄNDERT, nicht Teil des Formular-Umbaus
    ├── premium/route.ts   # POST — x402-geschützter Endpoint (0,10 USDC), liefert PDF-Zusammenfassung (Krypto, siehe unten — getrennt von Stripe)
    └── cron/check-updates/route.ts  # GET, per CRON_SECRET geschützt — wöchentlicher Quellen-Check (Phase 4)
scripts/
└── register-agent.ts      # Einmaliges ERC-8004-Registrierungsscript, lokal ausführen (npm run register-agent)
lib/
├── anthropic.ts           # Claude-API-Client (serverseitig)
├── stripe.ts                # Stripe-Server-Client (Kartenzahlung/Apple Pay/Google Pay) — getrennt von lib/x402.ts (Krypto)
├── paywall.ts               # Kill-Switch (PAYWALL_ENABLED), siehe eigener README-Abschnitt oben
├── pricing.ts               # EINZIGER Ort für den Detailanalyse-Preis, siehe Abschnitt unten
├── assessmentSession.ts    # Upstash-Redis-Session pro Zahlungsvorgang, TTL 2 Std. — Bindeglied zwischen Stripe-Webhook und Detailanalyse
├── interviewAnswers.ts     # Datenmodell (Stage1Answers/Stage2Answers) + Options-Listen, von UI und Serialisierung geteilt
├── serializeAnswers.ts     # wandelt strukturierte Antworten in den Text um, der als EINE Nachricht ans Modell geht
├── x402.ts                 # x402-Resource-Server-Konfiguration (Facilitator, Celo Mainnet, Agent-Wallet)
├── chat.ts / doc.ts       # System-Prompts + Interviewlogik je Arm — chat.ts: runInterview/buildSystemPrompt bleiben UNVERÄNDERT für Telegram (freies Gespräch); runQuickAssessment (Stufe 1) und runDetailedAssessmentFromAnswers (Stufe 2) sind eigene, einmalige (nicht Turn-basierte) Funktionen für das Web-Formular
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
- `ANTHROPIC_API_KEY` — sonst antworten `/api/assessment`, `/api/detailed-assessment` und `/api/doc` mit einem Konfigurationsfehler.
- `TELEGRAM_BOT_TOKEN` — Bot-Token von @BotFather.
- `TELEGRAM_WEBHOOK_SECRET` — beliebiger langer Zufallsstring (z.B. `openssl rand -hex 32`). Ohne diese Variable lehnt `/api/telegram` **jede** Anfrage mit 401 ab (fail closed) — sie muss vor dem `setWebhook`-Aufruf unten gesetzt sein, siehe dort.
- `UPSTASH_REDIS_KV_REST_API_URL` / `UPSTASH_REDIS_KV_REST_API_TOKEN` — über Vercel Storage → Marketplace → Upstash (Redis) provisionieren und mit dem Projekt verbinden. **Achtung bei eigenem Custom-Prefix**: die Vercel-Integration legt je nach gewähltem Prefix andere Variablennamen an als Upstashs eigene Konvention (`UPSTASH_REDIS_REST_URL`/`_TOKEN`) — `lib/telegramSession.ts` liest die Werte deshalb explizit unter den oben genannten Namen, nicht über `Redis.fromEnv()`. Nach dem Verbinden im Dashboard nachsehen, welche Namen tatsächlich entstanden sind. Vercel KV (das native Produkt) wurde Ende 2024 eingestellt. Wird jetzt auch von `lib/assessmentSession.ts` für die Detailanalyse-Freischaltung genutzt (dieselbe Instanz, kein zweites Redis nötig).
- `STRIPE_SECRET_KEY` — aus dem Stripe-Dashboard, geheim, nie im Client.
- `STRIPE_PUBLISHABLE_KEY` — aus dem Stripe-Dashboard, nicht geheim, wird aber bewusst über `/api/stripe/config` statt `NEXT_PUBLIC_...` ausgeliefert (siehe Kommentar in der Route) — trotzdem als normale (nicht `NEXT_PUBLIC_`) Vercel-Variable eintragen.
- `STRIPE_WEBHOOK_SECRET` — aus dem Stripe-Dashboard, nach Anlegen des Webhook-Endpoints (siehe unten). Ohne diese Variable lehnt `/api/stripe/webhook` jede Anfrage mit 500 ab.
- `DETAILED_ANALYSIS_PRICE_CENTS` (optional) — überschreibt den Platzhalter-Preis in `lib/pricing.ts` (aktuell 500 = 5,00 €, **nicht final kalkuliert**). Siehe Abschnitt "Zweistufige Auswertung" unten.
- `PAYWALL_ENABLED` (optional, Kill-Switch) — **Default: aus** (unset oder jeder Wert außer exakt `"true"`). Siehe eigener Abschnitt direkt unten, vor "Zweistufige Auswertung".
- `AGENT_WALLET_ADDRESS` (optional) — die BASTET-Agent-Wallet, öffentliche Adresse, Default in `lib/x402.ts` bereits gesetzt (`0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608`). Nur als `payTo` in `/api/premium` verwendet, keine Zahlungspflicht für Web/Telegram.
- `X402_FACILITATOR_URL` (optional) — Default `https://x402.celo.org`.

### Kill-Switch: `PAYWALL_ENABLED`

Die gesamte Zahlungsschranke (Stripe) ist per **einem** Flag komplett abschaltbar, ohne dass der Code dafür entfernt oder umgebaut werden muss. Betrifft NUR Stufe 2 (Detailanalyse) — Stufe 1 (Schnell-Einschätzung) ist immer kostenlos, unabhängig vom Flag:

- **`PAYWALL_ENABLED` unset oder ≠ `"true"` (Default, aktueller Stand):** Stufe 2 liefert direkt, ohne Zahlungsschritt, ohne Stripe-Elemente, ohne Webhook/Entitlement-Check im Pfad.
- **`PAYWALL_ENABLED=true`:** Stufe 2 läuft über Stripe Express Checkout Element (Apple Pay/Google Pay) wie unten beschrieben.

**Einziger Verzweigungspunkt im gesamten Code**: `app/api/detailed-assessment/route.ts` (POST-Handler), eine `isPaywallEnabled()`-Prüfung (Funktion aus `lib/paywall.ts`) — bei `true` wird nur eine `sessionId` akzeptiert und die Session muss bereits `"paid"` sein; bei `false`/unset werden `stage1`/`stage2` direkt akzeptiert und sofort ausgewertet. Kein zweiter Ort prüft dieses Flag sicherheitsrelevant — `app/page.tsx` fragt es zusätzlich per `GET /api/pricing` ab, aber nur um den richtigen Datenschutz-Hinweistext anzuzeigen und `app/DetailedAnalysisFlow.tsx` mitzuteilen, welchen der beiden Wege es nehmen soll (rein für UI-Verzweigung, keine Sicherheitsprüfung). Die komplette Stripe-Infrastruktur (`app/api/checkout`, `app/api/stripe/webhook`, `lib/assessmentSession.ts`) bleibt bei deaktiviertem Kill-Switch unverändert im Repo, wird aber schlicht nie erreicht.

**Vor Live-Gang mit echter Zahlungspflicht**: `PAYWALL_ENABLED=true` setzen, UND die Stripe-Dashboard-Schritte unten UND den finalen Preis (`DETAILED_ANALYSIS_PRICE_CENTS`) erledigt haben — die Reihenfolge ist wichtig, sonst zeigt die App eine funktionslose oder falsch bepreiste Zahlungsschranke an.

### Formularbasiertes Interview: kostenlose Schnell-Einschätzung + Detailanalyse

Der Web-Betroffenen-Arm nutzt seit dem Formular-Umbau **kein freies Chat-Interview mehr** — der Telegram-Arm dagegen unverändert (`app/api/telegram/route.ts` → `lib/chat.ts` `runInterview`, wird von diesem Umbau nicht berührt). Grund für den Umbau: Ohne Pausierbarkeit/Fortsetzbarkeit (bewusst keine neue Persistenz-Infrastruktur, siehe unten) ist die **Kürze des Fragebogens selbst** die PEM-Schutzmaßnahme (post-exertionelle Malaise durch zu lange/anstrengende Sitzungen) — nicht Pausierbarkeit. Ein deutlich zusammengestrichener, kombinierter Fragenkatalog (27 Fragen statt ursprünglich ~44 angedacht) mit ehrlicher "keine Speicherung vor Abschluss"-Kommunikation erreicht dasselbe Ziel ohne die Komplexität eines Fortsetzungs-Mechanismus.

**Kein neuer Persistenz-Layer**: Die Antworten leben ausschließlich als React-State im Browser (`app/page.tsx`), bis eine Stufe abgeschickt wird — schließt man die Seite vorher, sind sie weg (wird auch so kommuniziert, kein Resume-Versprechen). Die einzige serverseitige Speicherung ist die bereits bestehende, TTL-begrenzte `lib/assessmentSession.ts` (2 Std.), und die greift ausschließlich, wenn `PAYWALL_ENABLED=true` ist — sonst überhaupt nicht.

**Stufe 1 — kostenlos, 8 Fragen** (`app/Stage1Form.tsx` → `app/api/assessment/route.ts` → `lib/chat.ts` `runQuickAssessment`): ein einziges, auf einmal ausgefülltes Formular (Infektionszeitpunkt/-nachweis, Akutverlauf, Beruf, beruflicher Kontakt/BK-Meldung, Beschwerdebeginn/-verlauf, Gesamttendenz, Symptomüberblick, Vorerkrankungen). Wird als EINE serialisierte Nachricht (`lib/serializeAnswers.ts` `serializeStage1`) an ein günstiges/schnelles Modell (`claude-haiku-4-5-20251001`) geschickt, OHNE Wissensbasis im Kontext — liefert eine vorsichtig-hypothetisch formulierte, unsourcete Kurzeinordnung anhand vier grober Kriterien (PEM, Dauer, Alltagsbeeinträchtigung, beruflicher Zusammenhang), NIEMALS konkrete GdB-/MdE-Zahlen, keine Quellenbelege. Bleibt No-Storage.

**Stufe 2 — 19 weitere Fragen** (`app/Stage2Form.tsx` → `app/api/detailed-assessment/route.ts` → `lib/chat.ts` `runDetailedAssessmentFromAnswers`, eine EIGENE Funktion/eigener Prompt, getrennt von `runInterview` — dieses bleibt für Telegram unverändert): ein durchgehendes Formular in Abschnitten (Fatigue/PEM, Kognitiv, Riech-/Schmeck, Kreislauf/PoTS, Herz-Kreislauf, Atemwege, Psyche, ME/CFS-Doppelprüfung, Vorschäden & Verlauf) mit einfachem Fortschrittszähler ("X von Y beantwortet"), keine Unterbrechbarkeit zwischen den Abschnitten. **Jede Freitextfrage hat einen sichtbaren "Überspringen"-Button**; übersprungene Antworten werden im Prompt explizit als "— übersprungen —" markiert und dürfen vom Modell NIE stillschweigend als "nein" gewertet werden (Anweisung im System-Prompt) — ebenso fehlt-noch-Antworten ("— keine Angabe —"). Volles Modell (Sonnet) MIT vollständiger Wissensbasis, liefert **drei strikt getrennte Ergebnisblöcke** (nie zu einem Gesamturteil verschmolzen): GUV-Spur (BK-3101-Kausalitäts-Check anhand der drei Prüfschritte aus der Wissensbasis — bewusst OHNE eine Anknüpfungstatsachen-Punktbewertung oder eine KldB-Berufsliste, weil beides in der kuratierten Wissensbasis nicht vorhanden ist und nicht erfunden werden darf), Schwerbehindertenrecht-Spur (GdB) und Erwerbsminderungsrente-Spur (EMR, inkl. Hinweis auf "Summierung ungewöhnlicher Leistungseinschränkungen" wo plausibel). Zusätzlich eine ME/CFS-Doppelprüfung, die IOM- und CCC-Kriterien getrennt meldet ("Nach IOM-Kriterien: …" / "Nach CCC: …", nie zusammengefasst). Alle konkreten Werte/Schwellen kommen aus der Wissensbasis, nie hartkodiert im Prompt.

**Ablieferung**: die Detailanalyse erscheint inline (`app/DetailedAnalysisFlow.tsx`, dieselbe REFERENZEN-Anzeige/Kopier-UI wie bisher, inkl. BGW-Brief-Feature) — bewusst **kein** PDF-Download für dieses Feature (PDF-Erzeugung existiert im Repo bereits für einen anderen Zweck, `app/api/premium/route.ts`, dort als eigenständiges x402/Krypto-Feature mit anderer Zielsetzung — "Dossier zum Mitnehmen" statt Auswertungs-Ausgabe).

**Preis**: `lib/pricing.ts`, EINZIGER Ort — `DETAILED_ANALYSIS_PRICE_CENTS` (Konstante, überschreibbar per gleichnamiger Env-Var). Ändert man den Wert dort, aktualisiert sich automatisch: der Stripe-PaymentIntent-Betrag (`app/api/checkout/route.ts`), der angezeigte Preis (`GET /api/pricing`, von `app/DetailedAnalysisFlow.tsx` zur Laufzeit abgerufen — bewusst nicht als `NEXT_PUBLIC_`-Variable im Client-Bundle eingebrannt, damit eine Preisänderung ohne Rebuild-Unsicherheit überall ankommt). **Der Platzhalter (5,00 €) ist nicht kalkuliert** — vor Live-Gang durch den tatsächlichen Wert ersetzen (Berechnungsgrundlage: reale Anthropic-API-Kosten pro Detailanalyse).

**Zahlungsablauf bei `PAYWALL_ENABLED=true` (Stripe Express Checkout Element, Apple Pay/Google Pay)**:
1. Nutzer:in bestätigt zuerst die gesetzlich vorgeschriebene Checkbox (§ 356 Abs. 5 BGB, Widerrufsverzicht bei sofort bereitgestellten digitalen Inhalten) — **erst danach wird das Express-Checkout-Element überhaupt gemountet**, es existiert vorher nicht im DOM (nicht nur deaktiviert/versteckt).
2. Bei Zahlungsbestätigung (`onConfirm`): `POST /api/checkout` legt eine Assessment-Session in Redis an (`status: "pending_payment"`, Inhalt jetzt `stage1`/`stage2` statt eines Chat-Transkripts) und einen Stripe-PaymentIntent mit `metadata.sessionId`.
3. `stripe.confirmPayment(...)` bestätigt die Zahlung (Apple Pay/Google Pay brauchen dafür keinen Redirect).
4. Stripe sendet `payment_intent.succeeded` an `/api/stripe/webhook` (signaturgeprüft) → Redis-Session wird auf `status: "paid"` gesetzt.
5. Client pollt `POST /api/detailed-assessment` (bis zu 8× im 1,5-Sekunden-Abstand) — liefert erst, wenn der Webhook-Status `"paid"` erreicht hat.

**Manuelle Schritte im Stripe-Dashboard, die noch offen sind (kann ich nicht selbst erledigen):**
1. Stripe-Account anlegen/verifizieren, falls noch nicht geschehen.
2. Unter **Settings → Payment methods → Apple Pay** die Domain `www.bastet-covid.org` verifizieren (Datei-Download + Hosting unter `/.well-known/apple-developer-merchantid-domain-association` — Stripe führt durch diesen Schritt; ohne Verifizierung zeigt Apple Pay im Express-Checkout-Element nichts an).
3. `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` als Vercel-Environment-Variables eintragen (Live- oder Test-Keys, je nach Phase).
4. Unter **Developers → Webhooks** einen Endpoint auf `https://www.bastet-covid.org/api/stripe/webhook` anlegen, Event `payment_intent.succeeded` abonnieren, den erzeugten Signing Secret als `STRIPE_WEBHOOK_SECRET` eintragen.
5. Vor Live-Gang: `DETAILED_ANALYSIS_PRICE_CENTS` auf den tatsächlich kalkulierten Preis setzen (siehe oben).

**`.npmrc` mit `legacy-peer-deps=true`**: `@x402/next` 2.x pinnt `next: ">=16.2.6"` als Peer, verwendet aber ausschließlich die seit Next 15 stabile `next/server`-API (`NextRequest`/`NextResponse`) — der Pin ist konservativer als die tatsächliche Kompatibilität. Ohne `.npmrc` bricht `npm install` (auch auf Vercel) mit `ERESOLVE` ab.

**Domain `doc.bastet-covid.org`**: unter Vercel → Settings → Domains zum Projekt `bastet` hinzufügen (nicht `www.doc...`). Da Vercel auch Registrar von `bastet-covid.org` ist, sollte der DNS-Eintrag automatisch entstehen.

**Telegram-Webhook setzen**, sobald der Code deployt und `TELEGRAM_BOT_TOKEN`/`TELEGRAM_WEBHOOK_SECRET`/`UPSTASH_...` gesetzt sind — **unbedingt die `www.`-Domain verwenden**, nicht die Apex-Domain: `bastet-covid.org` liefert einen 308-Redirect auf `www.bastet-covid.org`, und Telegrams Webhook-Zustellung folgt Redirects auf POST-Requests nicht — die Domain sähe dann "gesetzt" aus, aber es käme nie eine Nachricht an. **`secret_token` muss exakt dem Wert von `TELEGRAM_WEBHOOK_SECRET` entsprechen** — ohne (oder mit falschem) `secret_token` weist `/api/telegram` jede Zustellung mit 401 ab und der Bot bleibt stumm:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://www.bastet-covid.org/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
`<TELEGRAM_BOT_TOKEN>` und `<TELEGRAM_WEBHOOK_SECRET>` durch die echten Werte ersetzen — nie im Klartext committen oder in einen Chat einfügen.

**Sicherheitshinweis (behoben)**: Bis einschließlich Commit `2ea225f` (Stand 6. September 2026, per externem Audit gefunden) prüfte `/api/telegram` die Herkunft eingehender Requests nicht — `handleAdminCommand` (`lib/adminCommands.ts`) vertraute allein der `chat.id` im Request-Body, sodass ein gefälschter Direkt-Request an den Endpoint (unter Umgehung von Telegram) mit bekannter/erratener Admin-chat_id den Freigabe-Workflow der Wissensbasis erreichen konnte. Jetzt per `X-Telegram-Bot-Api-Secret-Token`-Header (`TELEGRAM_WEBHOOK_SECRET`, oben) abgesichert — **bestehende Deployments müssen den Webhook mit `secret_token` neu setzen (Befehl oben), sonst bleibt der Bot nach dem Deploy stumm.**

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

**AskBots-Submission (Track 3, "AskBots CLI Growth Track")**: `askbots-submission.json` im Repo-Root enthält die vorbereitete Einreichung (6 Fragen, Budget 10 Reviews à 0,11 USDT = 1,10 USDT gesamt, `propertyType: "website"`, `propertyUrl: https://bastet-covid.org`) — lokal gegen die `askbots`-CLI (npm, v0.1.1) validiert:
```bash
npx askbots submit --file askbots-submission.json --json
```
Noch offen, beides nur lokal (bzw. über die Website) möglich, nicht aus dieser Session heraus (`www.askbots.ai` von der Netzwerk-Policy blockiert):
- Account bei askbots.ai anlegen, **Funding-Wallet = registrierte Agent-Wallet** (`0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608`, siehe Hackathon-Regeln zu Track 3) — wie genau das geht, stand nicht in der CLI-Dokumentation, sondern vermutlich unter `askbots.ai/docs`.
- `ASKBOTS_PASSWORD=... npx askbots login --email ...`, dann `npx askbots submit --file askbots-submission.json --execute` — **`--execute` ist in CLI-Version 0.1.1 noch nicht implementiert** ("Funding lands in the next release", laut CLI-README), liefert also aktuell noch keinen echten, bezahlten Review-Lauf. Vor dem ersten Einreichen `npx askbots version` prüfen, ob eine neuere Version das schon kann.

**ERC-8004 / x402 (Phasen 3–4, siehe `build/claude-code-buildplan.md`)**: Code steht, aber noch nichts on-chain ausgeführt.
- `scripts/register-agent.ts` — einmaliges Registrierungsscript für die ERC-8004 Identity Registry auf Celo Mainnet (`viem`, `data:`-URI-Metadaten). Lokal ausführen, **nie** in einer gehosteten Session mit echtem Private Key:
  ```bash
  AGENT_PRIVATE_KEY=0x... npm run register-agent
  ```
  Gibt am Ende `agentId` und die passende `https://www.8004scan.io/agents/celo/<id>`-URL für die Celo-Builders-Submission aus. Registry-Adresse/ABI stammen aus dem Build-Plan und sind **vor dem Ausführen mit echtem Geld** gegen `docs.celo.org` bzw. `github.com/celo-org/agent-skills` zu prüfen — von dieser Session aus war das nicht möglich (Netzwerk-Policy blockiert `docs.celo.org`, `forno.celo.org`, `8004scan.io`).
- `app/api/premium/route.ts` + `lib/x402.ts` — x402-geschützter Endpoint (`@x402/next` v2, 0,10 USDC, Celo Mainnet `eip155:42220`, `payTo` = Agent-Wallet). Nimmt eine bereits erzeugte Auswertung entgegen und liefert sie als PDF mit vollständigen Referenzen zurück. Nicht beworben, Web/Telegram/Doc-Arm bleiben kostenfrei.
- **Celo-Builders-Submission**: noch nicht ausgeführt — `celobuilders.xyz` war von dieser Session aus ebenfalls nicht erreichbar (Netzwerk-Policy). Muss aus einer Umgebung mit Netzwerkzugriff (lokal oder eine Session ohne diese Einschränkung) über den `celo-builders`-Skill nachgeholt werden.

**Attribution Tag**: `celo_6b8b070e35df` (zugewiesen bei der Celo-Builders-Frühregistrierung, `github.com/frerehugi/BASTET`). Laut Skill (`## Register Early`, `.agents/skills/celo-builders/SKILL.md`) muss der Tag per `toDataSuffix()` aus `@celo/attribution-tags` in jede Transaktion eingebettet werden, die die BASTET-Wallet (`0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608`) **direkt** signiert und sendet — x402-Facilitator-Settlements sind davon ausgenommen (Attribution läuft dort automatisch über die hinterlegte `agentWalletAddress`, der Tag lässt sich in eine Facilitator-Settlement-Transaktion technisch nicht einbetten). Codebase-Durchsuchung (`sendTransaction`/`writeContract`/`createWalletClient`) ergibt aktuell **eine** direkte Transaktion — die einmalige ERC-8004-Registrierung in `scripts/register-agent.ts`, bereits ausgeführt, nicht nachträglich änderbar. `app/api/premium/route.ts`/`lib/x402.ts` senden selbst keine Transaktion (reines Facilitator-Settlement) und tragen deshalb bewusst **keinen** `toDataSuffix()`-Aufruf. Sobald BASTET einen weiteren direkt signierten On-Chain-Pfad bekommt, muss der Tag dort ergänzt werden.

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
