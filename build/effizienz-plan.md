# BASTET — Effizienz-, Genauigkeits- und Kosten-Analyse (Stand 2026-09-13)

Analyse auf Basis des tatsächlichen Codes (nicht nur konzeptionell), Branch
`claude/bastet-efficiency-analysis-b2elx8`. Geprüfte Dateien: `lib/anthropic.ts`,
`lib/chat.ts`, `lib/doc.ts`, `lib/knowledgeBase.ts`, `lib/triage/*`,
`lib/format.ts`, `lib/reviewQueue.ts`, `app/api/{chat,doc,telegram}/route.ts`,
`build/testfaelle.md`, `build/claude-code-buildplan.md`.

**Diese Sitzung hat NICHTS am Code geändert** — reine Analyse, wie angefragt.

---

## Ausgangslage in Zahlen

- Wissensbasis: 21 Dateien, **195.573 Zeichen** / **21.966 Wörter** roh (`cat lib/knowledge/*.md | wc -c/-w`).
  Grobschätzung ~4 Zeichen/Token bei deutschem Fließtext → **~45.000–50.000 Tokens**
  allein für die Wissensbasis, pro Aufruf, ungecacht. Vor der Umsetzung mit
  `client.messages.countTokens(...)` exakt verifizieren (siehe Anthropic-API-Skill,
  `shared/token-counting.md`) — die Schätzung unten rechnet konservativ mit 48.000.
- System-Prompt-Grundgerüst (ohne Wissensbasis) in `lib/chat.ts`: ~1.840 Wörter
  ≈ 2.500–2.800 Tokens zusätzlich.
- `lib/anthropic.ts` nutzt **rohes `fetch`** gegen `api.anthropic.com/v1/messages`,
  kein Anthropic-SDK (`package.json` enthält keine `anthropic`-Abhängigkeit) — jede
  Umsetzung unten muss das entweder beibehalten (Caching/Streaming gehen auch per
  Raw-HTTP) oder als bewusste Zusatzentscheidung die SDK-Einführung vorschlagen.
- **Kein `cache_control` irgendwo im Code** (`grep -rn cache_control` → 0 Treffer).
  `system` wird in `lib/chat.ts`/`lib/doc.ts` als **einzelner String** übergeben,
  nicht als Block-Array — das ist die Voraussetzung für Punkt 1 unten.
- Modell überall: `claude-sonnet-5` (`lib/anthropic.ts:3`), `max_tokens: 16000`,
  kein Streaming, `maxDuration = 150` auf allen drei Routen.

Kostenrechnung Sonnet 5 (Preise aus dem Anthropic-API-Skill, Stand heute):
Input $2/MTok, Output $10/MTok, Cache-Read ~0,1× ($0,20/MTok), Cache-Write
5-Min-TTL ~1,25× ($2,50/MTok), 1-Std.-TTL ~2× ($4/MTok).

---

## 1. Prompt Caching

### Befund
Kein `cache_control` im Code. Schwerwiegender: Selbst wenn man naiv nur einen
`cache_control`-Marker ans Ende des heutigen `system`-Strings setzen würde,
würde er **kaum greifen**, weil die Prompt-Konstruktion in `buildSystemPrompt()`
(`lib/chat.ts:4-245`) dynamische Inhalte **vor** die Wissensbasis stellt:

- `triageBlock` (patientenspezifischer Tier-1-Kontext) direkt nach dem
  Einleitungssatz (`lib/chat.ts:10-21`)
- `STATUS DIAGNOSE: ...` als Ein-Zeiler direkt danach (`lib/chat.ts:28`)
- `turnBudgetHint` mitten im ZEITBUDGET-Abschnitt (`lib/chat.ts:76`), Text ändert
  sich **bei praktisch jeder Turn** ("Bisher 0 von…" → "Bisher 1 von…" → "Budget
  erreicht")
- Der komplette Themenliste-Block ist zudem je nach `triageContext`
  (vorhanden/nicht vorhanden) unterschiedlich (`lib/chat.ts:87-128`)
- Erst danach, als letzter Baustein, die 48K-Token-Wissensbasis
  (`lib/chat.ts:243-244`)

Da Prompt Caching ein reiner **Präfix-Match** ist (jede Bytedifferenz invalidiert
alles Nachfolgende), bedeutet diese Reihenfolge: Selbst mit einem Marker würde
im Grunde **nie** ein Treffer entstehen, weil vor der teuren Wissensbasis auf
jeder einzelnen Anfrage mindestens ein paar Bytes anders sind (Turn-Zähler-Text).
Das Problem ist also nicht "Marker fehlt", sondern **die Baureihenfolge des
Prompts ist strukturell cache-feindlich**.

Gleiches gilt für `lib/doc.ts` (kein Turn-Budget, aber gleiche Grundstruktur:
Regeln vor der Wissensbasis — dort zumindest keine Pro-Turn-Variabilität, da
Einzelaufruf).

`lib/knowledgeBase.ts:62-72` hängt zusätzlich einen optionalen, selten
wechselnden Redis-Addendum-Text **hinter** die 21 statischen Dateien — das ist
von der Reihenfolge her bereits cache-freundlich vorbereitet (Änderungen am
Addendum invalidieren nur den Suffix, nicht die 195KB Kern-Wissensbasis, sofern
man dafür einen eigenen Breakpoint setzt).

### Empfehlung
`system` von String auf Block-Array umstellen und **die Reihenfolge umkehren**:

1. **Block A** — feste Regeltexte (GRUNDREGELN, AUSWERTUNGS-FORMAT, ZITIERWEISE
   etc.), aber **arm-spezifisch in maximal 2 feste Varianten** aufgeteilt statt
   String-Interpolation: eine Variante für "triageContext vorhanden" (Web-Chat
   mit Tier-1-Vorlauf), eine für "nicht vorhanden" (Telegram, ggf. Doc-Arm) —
   die Themenliste ist ohnehin nur zweiwertig (`lib/chat.ts:87-128`), das lässt
   sich als zwei statische Templates statt Laufzeit-Interpolation schreiben.
   `cache_control: {type: "ephemeral", ttl: "1h"}` an dessen Ende.
2. **Block B** — die 21 statischen Wissensbasis-Dateien (`getStaticKnowledgeBase()`),
   byte-identisch für alle Anfragen. Eigener `cache_control`-Breakpoint am Ende.
   Getrennt von Block A, damit ein Deploy, der nur die Regeltexte ändert, nicht
   die (viel teurere) Wissensbasis-Cache-Zeile mit invalidiert und umgekehrt.
3. **Block C** — Redis-Addendum (falls vorhanden) + alles wirklich Dynamische:
   `STATUS DIAGNOSE`, der konkrete `triageContext`-Inhalt (Antworten, nicht nur
   ob vorhanden), `turnBudgetHint`. **Kein** `cache_control` hier — bewusst der
   günstige, unvermeidlich variable Rest.
4. Für die wachsende `messages`-Historie innerhalb eines Interviews zusätzlich
   **automatisches** Top-Level-`cache_control` auf dem Request nutzen (deckt
   Multi-Turn-Muster ab) — Slots reichen (max. 4 Breakpoints, hier max. 3 genutzt).

Wichtig: **`role: "system"`-Mid-Conversation-Messages sind auf Claude Sonnet 5
laut Anthropic-API-Skill nicht verfügbar/nicht dokumentiert** (Quellen
widersprüchlich, im Zweifel als nicht unterstützt behandeln) — die
Dynamik-Trennung muss also über Blockreihenfolge innerhalb von `system` erfolgen,
nicht über den in der Doku beschriebenen Trick für neuere Modelle.

TTL-Wahl: Zielgruppe hat Brain Fog, Tippen ist anstrengend → Pausen zwischen
Turns können mehrere Minuten überschreiten. Empfehlung **`ttl: "1h"`** für
Block A/B, nicht den 5-Minuten-Default — die verdoppelten Schreibkosten
amortisieren sich, sobald mehr als ~3 Lesevorgänge pro Schreibfenster
zusammenkommen (bei mehreren parallelen Nutzer:innen über den Tag praktisch
immer der Fall). Nach Umsetzung über `usage.cache_read_input_tokens` /
`cache_creation_input_tokens` verifizieren, nicht raten.

**Nicht vergessen:** `lib/anthropic.ts:54-62` baut den Request-Body manuell —
`system` muss dort von `string` auf das Array-Format umgestellt werden, inkl.
Typanpassung der `callClaude`-Signatur.

### Geschätzter Aufwand
Mittel. Kein neues SDK nötig (Raw-HTTP unterstützt `cache_control` genauso),
aber: `buildSystemPrompt()` in beiden Armen muss strukturell umgebaut werden
(Block-Array statt String-Konkatenation, 2 statische Regeltext-Varianten statt
Laufzeit-Interpolation), `callClaude()`-Signatur ändert sich, und
`getKnowledgeBase()` muss statischen Teil und Addendum getrennt zurückgeben
statt als einen String. Realistisch 0,5–1 Tag inkl. Verifikation über
`usage`-Felder — kein Risiko für die fachliche Ausgabequalität, da inhaltlich
nichts am Prompt-Text geändert wird, nur an Struktur/Reihenfolge.

### Geschätzter Effekt
Größter Hebel im gesamten Katalog. Rechnung pro Interview (Web-Chat-Arm,
6–8 Turns) für die Wissensbasis-Tokens allein (48.000 Tokens angenommen):

| Szenario | Kosten für KB-Anteil über 7 Turns |
|---|---:|
| Heute (ungecacht, jeder Turn voll) | 7 × 48K × $2/MTok ≈ **$0,67** |
| Mit Caching (1 Write + 6 Reads, warme Cache-Zeile) | $0,12 (Write @1h-TTL) + 6 × $0,01 (Read) ≈ **$0,18** |
| Mit Caching bei bereits warmer Cache-Zeile (Normalfall bei Dauerbetrieb) | 7 × $0,01 ≈ **$0,07** |

→ **70–90 % Kostenreduktion** auf den KB-Anteil, der aktuell den mit Abstand
größten Teil des Input-Volumens ausmacht. Zusätzlicher Latenz-Effekt: ein
Cache-Read verarbeitet ~48K Tokens nicht neu, das senkt die Time-to-first-Token
spürbar — kommt Punkt 3 (Streaming) direkt zugute, auch unabhängig davon.

---

## 2. Selektive Wissensbasis statt immer alle 21 Dateien

### Befund
`lib/triage/context.ts` liefert `answersToContextText()` — eine reine
Textzusammenfassung der Tier-1-Rohantworten (PEM, Dauer, Schmerz, Kognition,
Autonomie, Arbeitsfähigkeit, `beruflicherKontext`, `bk3101Status`). Diese
Struktur wäre grundsätzlich geeignet, um z. B. bei `beruflicherKontext !== "ja"`
und `bk3101Status` unbeantwortet die BG-/MdE-spezifischen Dateien wegzulassen:

Konkret BG-/MdE-lastige Dateien (~84 KB von 195 KB, **~43 %** der Wissensbasis):
`unfallversicherung-mde.md` (12K), `unfallversicherung-gutachter-befangenheit.md`
(12K), `sgb-verfahrensrecht-begutachtung.md` (16K), `bg-pflichten-mitwirkung.md`
(16K), `bg-kontaktdaten.md` (8K), `standardbrief-bgw.md` (8K),
`sgb-index-alle-buecher.md` (12K).

Aber: Der System-Prompt verlangt in **beiden** Armen zwingend, den MdE-Block
**immer** auszugeben, auch bei fehlendem Berufsbezug ("nicht einschlägig, kurze
Begründung was fehlt" — `lib/chat.ts:165-166`, `lib/doc.ts:77-78`). Dafür
braucht das Modell zumindest die MdE-Systematik-Grundlagen (`gdb-mde-systematik.md`,
Teile von `versmedv-gdb-gds.md`), nicht zwingend die Kontaktdaten- oder
Standardbrief-Dateien. Eine binäre "BG-Dateien ja/nein"-Selektion ist also zu grob.

### Empfehlung
**Nicht vor Punkt 1 angehen, und wenn, nur konservativ:**

1. Selektive Ladung reduziert vor allem das **ungecachte** Kostenproblem. Nach
   Punkt 1 kostet die volle Wissensbasis im warmen Cache-Fall nur noch ~$0,01
   pro Aufruf (s. o.) — der Grenznutzen von Selektion schrumpft entsprechend
   drastisch, während das Zitierfähigkeits-Risiko bleibt.
2. Falls trotzdem umgesetzt: **keine kontinuierliche Datei-für-Datei-Auswahl
   pro Anfrage**, sondern **wenige feste Bundles** (z. B. "Standard" und
   "Standard + BG/MdE-Vertiefung"), damit die Cache-Präfixe pro Bundle über
   viele Nutzer:innen hinweg identisch bleiben (siehe Warnung unten). Jede
   dynamische Pro-Nutzer-Auswahl bricht die Cache-Wiederverwendung aus Punkt 1,
   weil jede Kombination eine eigene, seltener getroffene Präfix-Variante wird.
3. Kandidaten für ein optionales Bundle nur bei `beruflicherKontext === "nein"`
   UND kein `bk3101Status` beantwortbar: `bg-kontaktdaten.md`,
   `standardbrief-bgw.md` (reine Ablauf-/Kontakthilfen, erst relevant wenn ein
   BK-3101-Verfahren tatsächlich betrieben wird) — zusammen nur ~16 KB, geringer
   Nutzen. Die übrigen BG-Dateien (Kausalitätsstufen, Verfahrensrecht) tragen
   auch zur korrekten Begründung von "nicht einschlägig" bei und sollten bleiben.
4. **Nicht** an Einzelthemen wie Neurologie/Kardiologie/Schlaf selektieren — die
   CCC-Domänen (Schmerz, Kognition, Autonomie, Schlaf) werden laut
   Systemprompt ohnehin in jeder Auswertung durchdekliniert; das Weglassen
   einzelner Domänen-Dateien risikiert genau die vom Prompt geforderte
   "volle Wissensbasis aktiv nutzen"-Regel (`lib/chat.ts:52-56`) zu unterlaufen.

### Geschätzter Aufwand
Gering bis mittel, aber **abhängig von Punkt 1**: `getKnowledgeBase()` müsste um
eine Bundle-Auswahlfunktion erweitert werden, `chat.ts`/`doc.ts` müssten
`triageContext`/Formular-Eingaben in eine Bundle-Entscheidung übersetzen. Für
eine seriöse Umsetzung außerdem nötig: Regressionstests (Punkt 5), um zu
verifizieren, dass Weglassen keine Referenzen/Begründungsqualität kostet —
sonst nicht seriös beurteilbar.

### Geschätzter Effekt
Gering bis moderat, und **kleiner als intuitiv erwartet**, weil es mit Punkt 1
konkurriert statt sich zu addieren: im ungecachten Zustand ggf. 15–20 %
Tokenersparnis auf den BG-Randdateien; im gecachten Zustand (nach Punkt 1)
nur noch Bruchteile eines Cents pro Aufruf, dafür echtes Risiko für
Zitierfähigkeit/Vollständigkeit bei Grenzfällen (z. B. "unsicher" bei
`beruflicherKontext`, wie im Testfall Krankenschwester in `build/testfaelle.md`
Zeile 22-25 — genau dort ist die BG-Kausalitätsstufen-Datei wichtig, obwohl der
Fall auf den ersten Blick nach "kein Berufsbezug" aussehen könnte). **Empfehlung:
niedrige Priorität, nach Punkt 1 neu bewerten anhand echter Kostendaten.**

---

## 3. Streaming statt blockierendem Call

### Befund
`lib/anthropic.ts:54-62`: einfacher `fetch(...)` ohne `stream: true`, dann
`await response.json()` (Zeile 64) — der komplette Server-Call blockiert, bis
die volle Antwort (bis zu 16.000 Output-Tokens) fertig generiert ist, bevor
irgendetwas an den Client zurückgeht. Alle drei Routen (`app/api/chat/route.ts`,
`app/api/doc/route.ts`, `app/api/telegram/route.ts`) reichen das 1:1 durch —
`maxDuration = 150` auf jeder Route zeigt, dass mit langen Wartezeiten bereits
gerechnet wird. Bei der Zielgruppe (Post-COVID/ME-CFS, Brain Fog) ist reines
Warten ohne Rückmeldung besonders belastend — genau im Prompt selbst wird das
als Grund für kurze, entlastende Interaktionen angeführt (`lib/chat.ts:74`).

### Empfehlung
Zweigeteilt nach Kanal, da nicht alle Kanäle gleich gut streamingfähig sind:

- **Web-Chat-Arm (`/api/chat`, `app/page.tsx`)** — größter Hebel, da hier die
  Zielgruppe direkt wartet. `lib/anthropic.ts` auf `stream: true` umstellen,
  SSE-Events serverseitig parsen und als `ReadableStream` aus der Route
  zurückgeben (Next.js Route Handler unterstützt das nativ); Frontend auf
  inkrementelles Rendern umstellen. Wichtig: Die harte `max_tokens`-Abbruch-
  Prüfung aus `lib/anthropic.ts:85-89` (wirft bei `stop_reason: max_tokens`)
  muss im Streaming-Pfad erhalten bleiben — dort kommt `stop_reason` erst im
  letzten Event, nicht im ersten Chunk.
- **Doc-Arm (`/api/doc`)** — Einzelaufruf durch Fachpersonal, nicht die primär
  Brain-Fog-betroffene Zielgruppe, Auswertung wird ohnehin komplett gelesen,
  bevor sie nützlich ist. Streaming hier optional/niedrigere Priorität, außer
  als reine Wahrnehmungsverbesserung ("es tut sich was").
- **Telegram-Arm** — Telegram-Bot-API unterstützt kein natives Text-Streaming
  wie ein Web-SSE-Kanal; die pragmatische Verbesserung ist stattdessen
  `sendChatAction(chat_id, "typing")` alle paar Sekunden während des Anthropic-
  Calls (gibt "tippt…"-Indikator in Telegram), **nicht** volles Streaming.
  Geringer Aufwand, spürbarer Effekt für genau dieses Symptom (Warten ohne
  Signal).

Zusammenspiel mit Punkt 1: Cache-Reads verkürzen die Time-to-first-Token
zusätzlich zum Streaming-Effekt — beide Maßnahmen sollten gemeinsam betrachtet
werden, Streaming zuerst umsetzen (unabhängig von Caching wirksam), Caching
verstärkt den Effekt danach weiter.

### Geschätzter Aufwand
Mittel für den Web-Chat-Arm: Serverseitiges SSE-Parsing in `lib/anthropic.ts`
(neue Funktion oder Umbau von `callClaude`), Route-Handler-Umbau auf
`ReadableStream`-Response, Frontend-Anpassung in `app/page.tsx` (und
`app/TriageFlow.tsx`, falls dort ebenfalls Antworten gerendert werden) für
inkrementelles Rendering plus Fehlerbehandlung bei Verbindungsabbruch
mid-stream. Telegram-„typing“-Indikator: gering (ein zusätzlicher Call plus
Intervall-Timer um den bestehenden `runInterview`-Aufruf).

### Geschätzter Effekt
Kein Kosteneffekt (gleiche Tokenzahl), aber der **größte Hebel für gefühlte
Geschwindigkeit** bei genau der Zielgruppe, die laut Anforderung am meisten
unter Wartezeit leidet. Bei 16.000 möglichen Output-Tokens und aktuell
komplett blockierendem Verhalten ist die Differenz zwischen "nach x Sekunden
kommt der erste sichtbare Text" und "nach x Sekunden kommt alles auf einmal"
UX-seitig erheblich, unabhängig vom Kosten-Impact.

---

## 4. Modell-Tiering (günstigeres Modell für Teilaufgaben)

### Befund
Ein einziges Modell (`claude-sonnet-5`) für **alles**: Zwischenfragen im
Interview UND finale GdB/MdE/EMR-Auswertung laufen über denselben
`runInterview()`-Aufruf (`lib/chat.ts:247-267`) — es gibt **keine
Code-seitige Unterscheidung** zwischen "nächste Interviewfrage stellen" und
"jetzt final auswerten"; das entscheidet das Modell selbst anhand des
Prompts ("wenn genug Information vorliegt oder explizit gewünscht",
`lib/chat.ts:139`). Für ein sauberes Tiering bräuchte es zuerst einen
Code-seitigen Entscheidungspunkt, der diese beiden Modi trennt (siehe Punkt 6).

Wichtiger, oft übersehener Punkt: **Modellwechsel invalidiert Prompt-Caches
vollständig** (Caches sind modellgebunden, kein Escape-Hatch laut
Anthropic-API-Skill). Würde man pro Turn zwischen einem günstigen und einem
teureren Modell wechseln, würde die 48K-Token-Wissensbasis bei **jedem**
Wechsel neu (und ungecacht) verarbeitet — das widerspricht Punkt 1 direkt.
Rechnerisch: ein gecachter Sonnet-5-Read der Wissensbasis kostet ~$0,01;
ein ungecachter Aufruf mit Haiku 4.5 ($1/MTok Input) kostet für dieselben
48K Tokens **~$0,048** — trotz "billigerem" Modell teurer als der gecachte
Sonnet-Read, weil Haiku die Wissensbasis nie aus dem Cache bedienen könnte,
solange sie primär unter dem Sonnet-Cache-Namespace liegt.

### Empfehlung
Tiering **nicht** auf Ebene "Zwischenfrage vs. Auswertung innerhalb derselben
Konversation" verfolgen, solange dort die 48K-Token-Wissensbasis mitläuft —
das frisst den Tiering-Vorteil durch verlorene Cache-Treffer sofort wieder auf.
Stattdessen:

1. **Priorität für Tiering: Aufgaben, die die Wissensbasis nicht brauchen.**
   Aktuell gibt es keine solche im Code, aber Kandidaten für später: eine
   Krisen-/Suizid-Trigger-Vorprüfung (aktuell Teil des großen Prompts,
   `lib/chat.ts:60-63`), Eingabe-Validierung/Formatierungs-Nachbearbeitung,
   oder ein Klassifikator, der grob entscheidet "Zwischenfrage nötig oder
   auswertungsreif" (s. Punkt 6) — das sind kurze, KB-freie Aufrufe, für die
   Haiku 4.5 ohne Cache-Konflikt geeignet wäre, weil sie gar nicht denselben
   Cache-Präfix teilen müssen.
2. **Effort-Steuerung statt Modellwechsel** als schwächerer, aber
   cache-verträglicherer Hebel prüfen: `output_config.effort` niedriger für
   reine Zwischenfragen, höher für die finale Auswertung — laut
   Anthropic-API-Skill invalidiert ein `effort`-Wechsel zwar ebenfalls die
   Messages-Cache-Ebene, aber die Doku ist an dieser Stelle nicht eindeutig,
   ob auch System-/Tools-Cache betroffen sind (modellabhängig). **Vor
   Umsetzung mit `usage`-Feldern empirisch verifizieren**, nicht auf die
   Doku-Aussage allein verlassen.
3. Modellwechsel-Tiering nur dann sinnvoll neu bewerten, wenn Punkt 6
   (deterministische Vorstufe) so weit ausgebaut wird, dass die
   Zwischenfragen-Phase **ohne** Wissensbasis auskommt (z. B. wenn Tier 1
   bereits alle Pflichtthemen strukturiert abfragt und Tier 2 nur noch für
   Vertiefung + finale Auswertung mit Zitierpflicht zuständig ist) — dann
   wäre ein günstigeres Modell für die reine Gesprächsführung ohne
   Zitierpflicht denkbar, mit eigenem (kleinerem) Cache-Namespace.

### Geschätzter Aufwand
Hoch, **wenn** ernsthaft verfolgt — setzt Punkt 6 (Code-seitige Trennung
Interview-Modus/Auswertungs-Modus) voraus, sonst nicht sauber umsetzbar.
Isoliert (nur Effort-Tuning ohne Modellwechsel): gering, aber mit
Messaufwand zur Verifikation der Cache-Auswirkung.

### Geschätzter Effekt
Kleiner als in der Aufgabenstellung vermutet, sobald Punkt 1 umgesetzt ist —
der dominante Kostentreiber (Wissensbasis) wird durch Caching bereits auf
Cent-Beträge gedrückt, wodurch der modellseitige Hebel an Bedeutung verliert.
Realistischer Nutzen liegt eher bei **Output-Token-Kosten** (Sonnet 5:
$10/MTok Output) für sehr kurze, KB-freie Zusatzaufrufe — dort spart Haiku 4.5
($5/MTok Output) tatsächlich linear, unabhängig vom Caching-Thema.
**Empfehlung: niedrige bis mittlere Priorität, nach Punkt 1 und 6 neu bewerten.**

---

## 5. Automatisierte Regressionstests

### Befund
`build/testfaelle.md` enthält aktuell 2 ausführlich dokumentierte Testfälle
(Krankenschwester, Physiotherapeutin) mit **rein manueller** Prüfung anhand
von Freitext-Checklisten ("Worauf beim Review achten"). Mehrfach dokumentierte
reale Bugs, die genau die im Auftrag genannten harten Kriterien betreffen:

- `max_tokens`-Abbruch mitten im REFERENZEN-Block, zweimal aufgetreten
  (Commits `6494e40`, `47972ec` laut `build/testfaelle.md:28,84-90,99-107`) —
  bereits mit einer Code-seitigen Absicherung versehen
  (`lib/anthropic.ts:85-89`), aber **nicht automatisiert regressionsgetestet**.
- Vollständigkeit aller drei Blöcke (GdB/MdE/EMR) wird nur durch
  Prompt-Anweisungen erzwungen (`lib/chat.ts:35-47`, `lib/doc.ts:14-21`),
  keine automatisierte Prüfung.
- Referenz-Integrität (jede `[n]` im Text hat einen Eintrag im
  REFERENZEN-Block) wird nirgends geprüft — `lib/format.ts:36-49`
  (`splitReferences()`) trennt den Block bereits sauber ab und ist direkt als
  Test-Baustein wiederverwendbar, prüft aber selbst nicht auf
  Vollständigkeit/Verwaisung der Nummern.
- Interne Dateinamen-Leckage (`.md`-Strings im REFERENZEN-Block) hat bereits
  eine **zweite Verteidigungslinie** in Code (`lib/format.ts:17-28`,
  `stripKnowledgeFilenames()`) — explizit dokumentiert als Reaktion auf
  unzuverlässige reine Prompt-Befolgung (`lib/format.ts:9-15`). Genau das ist
  ein Muster, das regelmäßig regressionsgetestet werden sollte, weil es
  bereits einmal wiederkehrend beobachtet wurde.

### Empfehlung
Dreistufiges Testkonzept, aufsteigend nach Kosten/Aufwand:

**Stufe 1 — deterministische Struktur-Checks (kein LLM-Judge nötig, günstig,
schnell):**
Für jeden Testfall aus `build/testfaelle.md` (als strukturierte Fixtures
statt Freitext-Doku pflegen — z. B. `build/testfaelle.json` oder `.ts` mit
Eingabetext, erwarteten Merkmalen) automatisiert prüfen:
- Alle drei Block-Überschriften vorhanden (`── GdB`, `── MdE`, `──
  Erwerbsminderungsrente`) — regex auf die exakten Marker aus dem
  AUSWERTUNGS-FORMAT.
- Kein `stop_reason: max_tokens` (die Exception aus `lib/anthropic.ts:85-89`
  darf in diesen Testfällen nie geworfen werden — bei aktuellem Wissensbasis-
  Umfang ist 16000 knapp genug, dass das ein sinnvoller Dauer-Check bleibt).
- Referenz-Integrität: `splitReferences()` liefert `refs`; jede im Fließtext
  vorkommende `[n]` (regex `\[\d+\]`) hat einen passenden Eintrag `[n] ...` im
  `refs`-Array, und umgekehrt kein Eintrag im `refs`-Array ohne mindestens
  eine Verwendung im Text (verwaiste Referenz).
- Kein `.md`-Dateiname im finalen Output (Regressionstest genau für den
  bereits einmal beobachteten Bug, den `stripKnowledgeFilenames()` behebt —
  hier auf den Text **vor** `stripKnowledgeFilenames()` prüfen, um zu sehen,
  ob das Modell es überhaupt noch versucht, nicht nur ob die Nachbearbeitung
  greift).

**Stufe 2 — inhaltliche Erkennung der Testfall-Merkmale (keyword-/regex-basiert,
kein LLM-Judge):**
Pro Fixture hinterlegte erwartete Merkmale (z. B. `pemErkannt: true`,
`dauerErkannt: true`, `beruflicherZusammenhangErkannt: true`) gegen den
Antworttext matchen — grobe Stichwortsuche reicht für "wurde das Thema
überhaupt aufgegriffen" (z. B. "PEM" oder "post-exertionell" im Text bei
PEM-positiven Fällen). Kein Ersatz für fachliche Prüfung, aber ein harter,
günstiger Rauchtest, der bei jeder Prompt-/Wissensbasis-Änderung sofort
auffällt, wenn ein Kernthema plötzlich nicht mehr aufgegriffen wird.

**Stufe 3 — LLM-Judge / vollständiges Eval-Set (teurer, für Release-Gates):**
Für tiefere fachliche Qualität (Spannen-Plausibilität, Kalibrierungsanker-
Nutzung wie in `build/testfaelle.md` gefordert) ein echtes Eval-Set nach dem
Muster aus dem Anthropic-API-Skill (`shared/evals/build-eval.md`) aufbauen —
das ist ein eigenständiges Vorhaben mit eigenem Interview-Prozess (Grading-
Methode, Kosten pro Lauf), hier nur als Ausblick markiert, nicht Teil dieses
Plans.

**Betriebsmodus:** Stufe 1+2 sind echte API-Integrationstests (kosten Geld pro
Lauf, ~$0,10–0,20 pro Testfall bei aktuell ungecachter Wissensbasis, nach
Punkt 1 deutlich weniger) — als CI-Gate vor Release bzw. nächtlich laufen
lassen, nicht bei jedem Commit. Die 2 bestehenden Testfälle in
`build/testfaelle.md` sind ein guter Startpunkt, sollten aber auf mindestens
4–6 erweitert werden, um auch CCC-negative Fälle (PEM "nein"/"unklar"), reine
Web-Chat- ohne Tier-1-Vorlauf-Fälle (Telegram-Pfad) und Grenzfälle bei
`beruflicherKontext: "unsicher"` abzudecken.

**Wichtig für die Reihenfolge:** Diese Tests sollten **vor oder parallel zu**
den strukturellen Änderungen aus Punkt 1–4 entstehen, nicht danach — sie sind
das Sicherheitsnetz, das beurteilbar macht, ob Caching-Refactoring oder
selektive Wissensbasis die fachliche Qualität verändert haben.

### Geschätzter Aufwand
Stufe 1: gering (ein bis zwei Tage) — nutzt bereits vorhandene Bausteine
(`splitReferences`, `stripKnowledgeFilenames`), braucht nur Testrunner-Setup
und strukturierte Fixtures statt der aktuellen Freitext-Dokumentation. Stufe 2:
gering, baut direkt auf Stufe 1 auf. Stufe 3: groß, eigenständiges Vorhaben.

### Geschätzter Effekt
Kein direkter Kosten-/Latenzeffekt, aber **Voraussetzung für risikoarme
Umsetzung der Punkte 1, 2, 4, 6** — ohne automatisierte Checks ist jede
Prompt-/Architektur-Änderung nur durch (bereits als unzureichend erkannte,
siehe `build/testfaelle.md`) manuelle Stichproben abgesichert. Hoher
Hebel-Wert trotz "unsichtbarem" direktem Nutzen.

---

## 6. Deterministische Vorstufe erweitern

### Befund
Tier 1 (`lib/triage/scoring.ts`, `computeTriage()`) ist bereits **deutlich
weiter ausgebaut als der Auftrag vermuten lässt**: Es berechnet schon
regelbasiert (ohne LLM) eine GdB-Spanne (`gdbVon`/`gdbBis`,
`lib/triage/scoring.ts:104-158`), CCC-/IOM-Kriterienerfüllung, MdE-
Einschlägigkeit inkl. BK-3101-Status-Nuancen (`lib/triage/scoring.ts:160-175`),
und eine EMR-Kategorie (`lib/triage/scoring.ts:177-197`) — inklusive
Begründungstexten. `lib/triage/summary.ts` (`formatTriageSummary()`) macht
daraus sogar bereits eine vollständige, dem LLM-Format ähnliche Kurzauswertung
für die reine Tier-1-Anzeige (`app/TriageFlow.tsx`).

**Der eigentliche Befund:** Von diesem bereits vorhandenen, strukturierten
Ergebnis (`TriageResult` mit GdB-Spanne, MdE-Einschlägigkeit, EMR-Kategorie)
kommt **nichts** im Tier-2-LLM-Prompt an. `app/page.tsx:163` übergibt nur
`answersToContextText(answers)` — die **rohen Frage-Antwort-Paare**, nicht das
Ergebnis von `computeTriage()`. Der System-Prompt in `lib/chat.ts:10-21`
bekommt also z. B. "PEM → Ja" und "Arbeitsfähigkeit → 3 bis unter 6 Stunden"
als Rohdaten, aber **nicht** die bereits deterministisch berechnete
Schlussfolgerung "GdB-Spanne 50–60, Begründung: mittelschwere
Globalfunktionsstörung, Analogie VersMedV 3.1.1". Das Modell rekonstruiert
also bei jeder Tier-2-Auswertung dieselbe Spannenfindung, die Tier 1 bereits
regelbasiert und reproduzierbar geleistet hat — das ist exakt die im Auftrag
vermutete Streuungsquelle zwischen ähnlichen Fällen.

### Empfehlung
`computeTriage()`-Ergebnis (nicht nur die Rohantworten) als zusätzlichen,
klar gekennzeichneten Block in den Tier-2-Prompt aufnehmen — mit einer
wichtigen Nuance in der Formulierung, damit es als **Anker, nicht als
bindende Vorentscheidung** verstanden wird:

1. In `app/page.tsx` zusätzlich zu `answersToContextText(answers)` auch
   `computeTriage(answers)` aufrufen (dort bereits als Import verfügbar über
   `app/TriageFlow.tsx`-Muster) und beides an `/api/chat` übergeben, oder
   serverseitig in `app/api/chat/route.ts` aus den Rohantworten neu berechnen,
   falls die Rohantworten statt des fertigen Ergebnisses übertragen werden
   sollen (Bandbreite/Konsistenz-Tradeoff — beides vertretbar).
2. In `lib/chat.ts` einen neuen Block ergänzen (klar getrennt vom bisherigen
   `triageBlock`), der explizit als **"regelbasierte Voreinschätzung, kein
   Ersatz für deine eigene Prüfung"** gerahmt ist — Formulierungsvorschlag in
   Anlehnung an den bestehenden Ton: *"Tier 1 hat bereits eine regelbasierte
   Vorab-Spanne berechnet: GdB [von]–[bis] Prozent, Begründung: [...]. Nutze
   das als Kalibrierungsanker und Ausgangspunkt — weiche davon ab, wenn die
   Gesprächsdetails das rechtfertigen, aber nenne dann explizit, warum du von
   der Tier-1-Spanne abweichst."* Damit bleibt die fachliche Flexibilität des
   Modells erhalten (Detailinformationen aus dem Gespräch, die Tier 1 nicht
   erfassen kann, z. B. Freitext-Nuancen), aber die Streuung wird an einem
   reproduzierbaren Anker verankert statt komplett dem Freitext überlassen.
3. Gleiches Prinzip für MdE-Einschlägigkeit und EMR-Kategorie — dort ist
   `computeTriage()` teils sogar präziser als das, was das Modell aus
   Freitext ableiten müsste (z. B. die Unterscheidung "gemeldet, Verfahren
   offen" vs. "nicht gemeldet" vs. "anerkannt" in `mdeGrund`,
   `lib/triage/scoring.ts:168-175` — exakt die Nuance, die im Testfall
   Krankenschwester in `build/testfaelle.md:22-25` als Prüfpunkt genannt wird).
4. Für den Doc-Arm (`lib/doc.ts`) und Telegram (kein Tier-1-Vorlauf) ist diese
   Erweiterung **nicht direkt anwendbar**, da dort keine strukturierte
   Tier-1-Erhebung vorgeschaltet ist — das ist ein bewusster Geltungsbereich,
   keine Lücke, die hier zu schließen wäre. Mittelfristig ließe sich aber der
   gleiche `QUESTIONS`/`computeTriage()`-Baustein auch für den Doc-Arm
   anbieten, falls dort ein strukturiertes statt Freitext-Eingabeformat
   gewünscht ist — das wäre allerdings ein größerer Eingriff in `lib/doc.ts`
   und außerhalb des hier gestellten Auftrags.

### Geschätzter Aufwand
Gering. Die eigentliche "harte Vorab-Einordnung" existiert bereits
vollständig und ist fachlich durchdacht (siehe `scoring.ts`-Kommentare zu
VersMedV-Analogien) — es fehlt nur die **Weiterleitung** des bereits
berechneten Ergebnisses an Tier 2 plus eine Prompt-Ergänzung von wenigen
Zeilen. Realistisch < 1 Tag, deutlich weniger als eine Neuentwicklung der
Vorstufe vermuten ließe.

### Geschätzter Effekt
Potenziell hoch für die im Auftrag genannte Zielgröße "Streuung zwischen
ähnlichen Fällen reduzieren" — bei minimalem Umsetzungsaufwand, da die
eigentliche Rechenlogik bereits produktionsreif vorliegt. Sollte **vor** oder
zusammen mit Punkt 5 (Regressionstests) umgesetzt werden, da sich der Effekt
("weichen ähnliche Fälle jetzt weniger stark voneinander ab") nur mit
mehreren vergleichbaren Testfällen objektiv messen lässt — aktuell erlauben
die 2 Fälle in `build/testfaelle.md` das noch nicht (jeweils nur 1 Fall pro
Konstellation, kein Wiederholungs-/Streuungsvergleich).

---

## Wechselwirkungen zwischen den Punkten (nicht additiv denken)

- **1 vs. 2:** Caching macht die volle Wissensbasis so billig (~$0,01/Aufruf
  im Warmfall), dass selektives Laden nach Punkt 1 kaum noch etwas beiträgt,
  aber weiterhin Zitierfähigkeits-Risiko trägt. Reihenfolge: 1 vor 2, Punkt 2
  danach neu bewerten.
- **1 vs. 4:** Modellwechsel pro Turn zerstört den Cache vollständig; ein
  gecachter Sonnet-Read ist oft günstiger als ein ungecachter Aufruf eines
  "billigeren" Modells. Tiering nur für KB-freie Nebenaufgaben verfolgen.
- **5 vor 1/2/4/6:** Ohne automatisierte Checks ist jede der anderen
  Änderungen nur durch (bereits als unzuverlässig erkannte) manuelle Prüfung
  abgesichert. Stufe 1 aus Punkt 5 sollte technisch **zuerst** stehen, auch
  wenn sie im Auftrag als Punkt 5 nummeriert ist.
- **6 vor 4:** Modell-Tiering zwischen "Interviewfrage" und "Auswertung" setzt
  überhaupt erst einen Code-seitigen Unterscheidungspunkt voraus, den es
  aktuell nicht gibt — Punkt 6 (bzw. eine Erweiterung davon) wäre die
  Voraussetzung, nicht Punkt 4 selbst.

---

## Priorisierter Fahrplan

| Prio | Punkt | Aufwand | Effekt | Abhängigkeit |
|---|---|---|---|---|
| **P0** | 5 (Stufe 1: Struktur-Checks) | gering | Sicherheitsnetz für alles Weitere | — |
| **P0** | 1 (Prompt Caching, Reihenfolge + Breakpoints) | mittel | 70–90 % Kostenreduktion auf KB-Anteil, senkt TTFT | — |
| **P1** | 6 (Tier-1-Ergebnis an Tier 2 weiterreichen) | gering | weniger Streuung, gleicher Aufwand wie ein kleiner Prompt-Patch | 5 zur Messung |
| **P1** | 3 (Streaming Web-Chat-Arm) | mittel | größter UX-Hebel für die Zielgruppe | profitiert von 1, nicht abhängig |
| **P2** | 3 (Telegram "typing"-Indikator) | gering | kleiner, aber günstiger UX-Gewinn | — |
| **P2** | 5 (Stufe 2: Merkmal-Erkennung, Testfälle erweitern) | gering | belastbarere Regressionsbasis | 5 Stufe 1 |
| **P3** | 2 (selektive Wissensbasis, konservativ) | gering–mittel | gering nach Punkt 1, ggf. verzichtbar | 1, 5 |
| **P3** | 4 (Modell-Tiering für KB-freie Nebenaufgaben) | hoch bei voller Umsetzung | gering bis moderat | 1, 6 |
| **P4** | 5 (Stufe 3: LLM-Judge-Eval) | groß | tiefere fachliche Qualitätssicherung | 5 Stufe 1+2 |

---

## Offene Punkte vor einer Umsetzung

- Exakte Token-Zahl der Wissensbasis per `count_tokens`-Endpoint verifizieren
  (hier nur zeichenbasiert geschätzt).
- Reales Traffic-Muster (Anfragen pro Stunde, typische Pausen zwischen Turns)
  einschätzen, um die TTL-Wahl (5 Min. vs. 1 Std.) für Punkt 1 zu fundieren —
  aktuell keine Nutzungsstatistik im Repo einsehbar.
- Klären, ob eine Migration von Raw-`fetch` auf das offizielle Anthropic-SDK
  gewünscht ist (nicht zwingend nötig für Caching/Streaming, aber würde
  Streaming-Implementierung in `lib/anthropic.ts` vereinfachen — bewusste
  Entscheidung, keine Empfehlung dieses Dokuments).

---

**Diese Analyse enthält keine Code-Änderungen.** Nächster Schritt liegt bei
dir: Rückmeldung, ob/welche Punkte umgesetzt werden sollen, in welcher
Reihenfolge, und ob z. B. mit P0 (Regressionstest-Grundgerüst + Prompt-
Caching-Refactoring) begonnen werden soll.
