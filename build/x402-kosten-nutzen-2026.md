# x402-Endpoint — Kosten-Nutzen-Rechnung & Agent-Einstieg (Stand 2026-10-03)

Analyse auf Basis des tatsächlichen Codes und der echten, live-verifizierten
Zahlung vom 03.10.2026 (BOTKOV-Wallet → BASTET-Wallet, siehe README/
`build/phase10-english-expat-bastet.md`). Zwei Fragen beantwortet:

1. Was kostet ein Aufruf des x402-Endpoints an Anthropic-API-Spend, und was
   bekommt BASTET dafür zurück?
2. Wie machen wir Agenten, die BASTET aufrufen wollen, den Einstieg leichter?

**Diese Sitzung hat EINEN Bugfix am Code vorgenommen** (Cache-Präfix-Fehler,
Abschnitt 1.2) — alles andere ist Analyse/Empfehlung.

---

## 1. Kostenseite: Was kostet ein Aufruf?

### 1.1 Ausgangsgrößen

- Modell: `claude-sonnet-5` (`lib/anthropic.ts:3`), unverändert seit Projektstart.
- Preise (verifiziert über den Anthropic-API-Skill, Stand heute — identisch
  zu `build/effizienz-plan.md` vom 13.09.): Input **$2/MTok**, Output
  **$10/MTok**, Cache-Read **$0,20/MTok** (0,1×), Cache-Write 5-Min-TTL
  **$2,50/MTok** (1,25×), Cache-Write 1-Std-TTL **$4/MTok** (2×).
  `claude-sonnet-5-5` existiert inzwischen als Nachfolger zu **identischem
  Preis** — reine Qualitätsverbesserung ohne Kostenänderung, hier nicht
  weiter verfolgt (nicht Teil dieser Aufgabe), aber als kostenneutrale Option
  vorgemerkt.
- Wissensbasis (`lib/knowledge/*.md`, voller Bestand inkl. BG-Kontaktdateien,
  wie `getStaticKnowledgeBase(true)` ihn für den x402-Endpunkt lädt): **47
  Dateien, 716.797 Zeichen / 78.583 Wörter** (`wc -c -w` über exakt die in
  `lib/knowledgeBase.ts` `FILES`+`BG_KONTAKT_FILES` gelisteten Dateien).
  **Das ist ein Faktor ~3,7 gegenüber dem Stand von `build/effizienz-plan.md`
  (13.09.2026: 21 Dateien, 195.573 Zeichen)** — die Wissensbasis ist seither
  deutlich gewachsen (u.a. die beiden in dieser Sitzung ergänzten Dateien,
  aber bei Weitem nicht nur die).
- Tokenschätzung: wie in `build/effizienz-plan.md` zeichenbasiert mit
  ~4 Zeichen/Token → **716.797 / 4 ≈ 179.000 Tokens** für die volle
  Wissensbasis. Gegenprobe wortbasiert (bei deutschem Fach-/Rechtstext eher
  1,3–1,6 Tokens/Wort wegen Komposita) ergibt **~115.000–125.000 Tokens** —
  spürbare Bandbreite. **Nicht exakt verifiziert** (kein `ANTHROPIC_API_KEY`
  in dieser Sandbox für `count_tokens` verfügbar) — wie beim Vorgängerdokument
  bewusst als offener Punkt markiert, hier mit dem höheren (konservativeren,
  weil kostenerhöhenden) Wert von **179.000 Tokens** weitergerechnet.
- Rules-Block (`buildRulesBlock()` in `lib/expatConsult.ts`, Englisch,
  x402-spezifisch, NICHT mit den deutschen Armen geteilt): 4.544 Zeichen /
  690 Wörter ≈ **1.150 Tokens**.
- Output: `maxTokens` wurde in dieser Sitzung von 4.000 auf **16.000**
  angehoben (siehe PR #81 — 4.000 reichte nicht, echter Zahlungstest endete
  in `max_tokens`-Abschneidung + 502, **nachdem** schon bezahlt war). Der
  tatsächlich beobachtete echte Output (BOTKOV-Test) war ≈ 900–1.000
  englische Wörter ≈ **~1.500 Tokens** — deutlich unter dem Limit, hier als
  realistischer Arbeitswert verwendet.

### 1.2 Befund + Fix: Cache-Zeile war isoliert, nicht geteilt

`lib/expatConsult.ts` behauptete in einem Kommentar, die Wissensbasis teile
sich dieselbe Cache-Zeile wie `lib/chat.ts`/`lib/doc.ts` ("Byte-Identität").
**Das stimmte nicht**: Prompt-Caching ist ein reiner Präfix-Match, und der
x402-Block hatte einen eigenen, englischen Label-Text
(`"KNOWLEDGE BASE (full, German-language primary sources..."`) vor der
Wissensbasis, während alle drei deutschen Arme
(`"WISSENSBASIS (vollständig, aus dem de-begutachtung-Skill):"`) verwenden.
Eine einzige Byte-Differenz im Präfix reicht, um die gesamte nachfolgende
179K-Token-Cache-Zeile zu entwerten — der x402-Endpunkt lief also faktisch
**immer mit einer eigenen, isolierten Cache-Zeile**, die nur durch seinen
eigenen Traffic warmgehalten werden konnte, nie durch den der deutschen Arme.

**Behoben in dieser Sitzung** (`lib/expatConsult.ts`, `buildSystemBlocks()`):
Label-Text exakt auf `"WISSENSBASIS (vollständig, aus dem de-begutachtung-
Skill):"` angeglichen — verifiziert identisch mit `lib/chat.ts:408`
(`buildSystemPrompt()`, Hauptinterview, Web-Chat-Arm), `lib/chat.ts:580`
(`buildBgHelpSystemBlocks()`) und `lib/doc.ts:168`. Alle vier Pfade liegen
jetzt als `system[0]` mit identischem Text — x402-Aufrufe können ab sofort
von JEDER Aktivität auf Web-Chat, Doc-Arm oder BG-Hilfe innerhalb der
letzten Stunde profitieren, nicht nur von eigenem x402-Traffic.

**Wichtig für die Einordnung des BOTKOV-Verifikationstests**: Dieser Fix kam
**nach** dem echten, settleten Zahlungstest vom 03.10. — der lief noch gegen
die isolierte Cache-Zeile und war ohnehin der allererste Aufruf dieses
Prompts überhaupt (Cache zwangsläufig kalt). Die Kostenrechnung für genau
diesen einen Aufruf in Abschnitt 1.3 ("Cold-Szenario") beschreibt also exakt,
was die 0,1-USAT-BOTKOV-Zahlung an echtem Anthropic-Spend ausgelöst hat.

### 1.3 Kostenszenarien pro Aufruf (nach dem Fix)

| Szenario | KB-Anteil | Rules-Block | Output (~1.500 Tok) | **Summe** |
|---|---:|---:|---:|---:|
| **Cold** (kein Arm in der letzten Stunde aktiv — Cache-Write) | 179.000 Tok × $4/MTok = $0,716 | 1.150 Tok × $4/MTok = $0,0046 | $0,015 | **≈ $0,74** |
| **Warm, geteilt** (irgendein Arm — Web/Doc/BG/x402 — war innerhalb der letzten Stunde aktiv) | 179.000 Tok × $0,20/MTok = $0,0358 | ~$0,0002 (warm) bzw. $0,0046 (x402-eigener Cold-Write beim ersten Mal) | $0,015 | **≈ $0,051–0,055** |

Fragetext selbst (~50–300 Tokens, ungecacht, $2/MTok) ist in beiden Fällen
vernachlässigbar (< $0,001).

### 1.4 Einnahmen und Marge (Stand zum Zeitpunkt dieser Analyse, 0,1 USAT)

**Hinweis: Der Preis wurde aufgrund genau dieser Zahlen am 03.10.2026 auf
3,0 USAT angehoben — siehe Abschnitt 3. Die folgende Tabelle zeigt bewusst
den ursprünglichen, inzwischen überholten Preis, als Beleg für die
Preisentscheidung.**

Preis (damals): **0,1 USAT pro Aufruf** (`lib/x402.ts`), USAT
1:1-USD-gekoppelter Stablecoin (Tether America USD) → **$0,10 Erlös pro
settletem Aufruf**.

| Szenario | Kosten | Erlös (damals, 0,1 USAT) | **Marge (damals)** |
|---|---:|---:|---:|
| Warm, geteilt | $0,051–0,055 | $0,10 | **≈ 45–49 %** |
| Cold (isolierter oder erster Aufruf) | $0,74 | $0,10 | **≈ −640 % (−$0,64 Verlust)** |

**Break-even innerhalb eines rollierenden 1-Stunden-Cache-Fensters**: Ein
Cache-Write ($0,716 für die KB) muss durch genug Folgeaufrufe im selben
Fenster amortisiert werden. Auflösen von
`0,716 + 0,0046 + (N−1)×0,0358 + N×0,015 = 0,10N` ergibt **N ≈ 14** — ab dem
14. Aufruf innerhalb derselben Stunde ist das Fenster insgesamt profitabel,
jeder Aufruf darüber hinaus trägt ~$0,049 Grenzgewinn bei. **Unterhalb von
14 Aufrufen/Stunde ist der Flow im Durchschnitt defizitär**, mit dem
Extremfall "genau 1 Aufruf in der Stunde" bei −$0,64.

**Realistische Einordnung**: Telegram zeigt laut `build/effizienz-plan.md`
aktuell 0 Nutzer, für Web-Chat/Doc-Arm existiert keine Nutzungsstatistik im
Repo (beides bereits dort als offener Punkt vermerkt). Ob der nach Abschnitt
1.2 reparierte geteilte Cache-Pfad in der Praxis tatsächlich warm bleibt,
hängt vollständig von Traffic ab, der aktuell nicht meßbar ist. **Empfehlung:
`usage.cache_read_input_tokens`/`cache_creation_input_tokens` aus den
`callClaude()`-Antworten loggen** (aktuell nirgends ausgewertet,
`lib/anthropic.ts` liest `usage` gar nicht aus) — ohne das bleibt die
45–49%-Zahl eine Modellannahme, keine gemessene Realität.

### 1.5 Die eigentlich kritische Zahl: zählt die Zahlung überhaupt fürs Leaderboard?

`build/hackathon-listing-plan.md:76` hält explizit fest: **"Jede
x402-Transaktion muss den zugewiesenen `attributionTag` im Data-Suffix
tragen (`toDataSuffix()` aus `@celo/attribution-tags`) — sonst zählt sie
nicht fürs Leaderboard."** Weder `lib/x402.ts` noch
`app/api/x402/[[...route]]/route.ts` referenzieren `@celo/attribution-tags`
oder einen `attributionTag` irgendwo — `grep -rn attribution` im gesamten
Repo findet nur die Planungsdokumente, keinen Code. Eine Celo-Builders-
Registrierung (`build/hackathon-listing-plan.md` Abschnitt 3, die den Tag
überhaupt erst vergibt) ist ebenfalls noch nicht erfolgt.

**Konsequenz**: Die echte, settlete BOTKOV-Zahlung vom 03.10.2026 — on-chain
verifiziert, $0,10 Erlös, ~$0,74 Anthropic-Kosten — zählt nach aktuellem
Stand **für das Hackathon-Leaderboard nicht mit**, obwohl technisch alles
funktioniert. Das ist für "was bekommen wir für die Anfragen" die
wichtigere Antwort als die Centbeträge oben: **aktuell: echter Umsatz, aber
null Hackathon-Anrechnung.** Submission-Fenster beginnt laut
`build/phase10-english-expat-bastet.md` am 06.10.2026 (Kickoff-Call, 8 Uhr
ET) — noch Zeit, aber eng.

**Empfehlung (nicht umgesetzt, da externe/konsequenzreiche Aktion — Rückmeldung
abwarten):**
1. `celo-builders`-Skill nutzen, Hackathon-Slug bestätigen, früh registrieren
   (`PUT /submissions/me`) → liefert den echten `attributionTag`.
2. `toDataSuffix()` aus `@celo/attribution-tags` in die Payment-Konstruktion
   von `lib/x402.ts` einbauen (genauer Ansatzpunkt hängt von der
   `@x402/evm`-Payload-Struktur ab — beim Umsetzen gegen die echten
   `.d.ts`-Dateien prüfen, nicht raten, wie bei der ursprünglichen
   SDK-Migration).

---

## 2. Agents den Einstieg leichter machen

Der Endpunkt selbst ist protokollkonform (402 liefert vollständige
`PaymentRequirements` — Preis, Asset, `payTo`, Netzwerk, alles maschinell
auswertbar). Das Problem ist **Auffindbarkeit**, nicht Protokoll-Konformität:
ein Agent muss die URL bereits kennen, um überhaupt den ersten Request zu
stellen.

### 2.1 Celo Bazaar — offizieller Discovery-Mechanismus (grundiert, nicht spekuliert)

`@x402/extensions` (bereits transitiv installiert, aber noch nicht als
eigene Dependency genutzt) enthält ein vollständiges Bazaar-Modul — den
offiziellen Celo-Marktplatz für x402-Ressourcen, der direkt zu Track 3
"Build with buy" passt (siehe `build/phase10-english-expat-bastet.md`
Abschnitt 2, dort noch als "nicht recherchiert" markiert):

- `bazaarResourceServerExtension` — per `resourceServer.registerExtension(...)`
  auf dem bestehenden `x402ResourceServer` aus `lib/x402.ts` registrierbar.
- `declareDiscoveryExtension({...})` — deklariert pro Route Service-Name,
  Tags, Input-/Output-Schema und ein Beispiel (`output.example`) für den
  Bazaar-Katalog.
- `withBazaar(facilitatorClient)` — clientseitig, falls BASTET selbst
  irgendwann andere x402-Ressourcen entdecken soll (nicht akut relevant).
- `BAZAAR` — die Facilitator-Extension-Konstante für den Celo-Bazaar-Endpunkt
  selbst.

**Noch nicht umgesetzt** (echte Design-Entscheidungen nötig: Service-Name,
Tags, Beispiel-Frage/-Antwort fürs Schema — plus ein Test gegen den echten
Facilitator) — Vorschlag, falls gewünscht: eigener kleiner Umsetzungsschritt,
analog zur ursprünglichen x402-SDK-Migration (gegen die echten `.d.ts`-Dateien
von `@x402/extensions` bauen, nicht aus der Erinnerung).

### 2.2 Agent-lesbare Beschreibung am Endpunkt selbst

Aktuell liefert nur `POST` ohne Zahlung die technischen `PaymentRequirements`
(inkl. `description`-Feld, bereits recht aussagekräftig). Was fehlt: ein
kurzes, **narratives** Dokument nach dem Muster von `x402.celo.org/SKILL.md`
(demselben Muster, das diese Sitzung selbst genutzt hat, um den Facilitator
zu integrieren) — Zweck des Endpunkts, Beispiel-Request/-Response,
Preislogik, in einfachem Markdown unter einer stabilen, gut auffindbaren
URL (z. B. `GET /api/x402/consult` ohne Payment-Erwartung, oder
`/.well-known/x402-skill.md`). Senkt die Einstiegshürde für jeden Agenten/
jedes Agent-Framework, das selbst nach solchen Dateien sucht (viele
x402-Clients und Coding-Agents tun das inzwischen routinemäßig).

### 2.3 Veröffentlichtes Beispiel-Skript

Das in dieser Sitzung für den BOTKOV-Test gebaute Skript
(`x402-payment-test.mjs` — offizielles SDK, `x402Client` +
`registerExactEvmScheme` + `x402HTTPClient`, 402 → signierte EIP-3009-Payload
→ Retry) ist bereits ein vollständiges, verifiziert funktionierendes
Referenzbeispiel. Aktuell existiert es nur als Chat-Anhang. Als
`examples/x402-payment-test.mjs` im Repo (oder in einem öffentlich verlinkten
Gist) gäbe es anderen Agent-Entwickler:innen ein copy-paste-fähiges,
nachweislich funktionierendes Integrationsbeispiel, statt dass jede:r das
Protokoll aus der rohen 402-Antwort selbst rekonstruieren muss.

### 2.4 ERC-8004-Registrierung nutzen

BASTET ist bereits unter ERC-8004 registriert (Agent-IDs 9817/9818, siehe
`lib/content.ts`) — das ist der Standard, über den Agenten nach vertrauens-
würdigen Gegenparteien suchen. Ob/wie der x402-Endpunkt in den ERC-8004-
Metadaten dieser Identität verlinkt ist, wurde hier nicht geprüft — falls
nicht, wäre das ein kurzer, lohnender nächster Schritt (reine Metadaten-
Ergänzung, kein neuer Code-Pfad).

---

## 3. Preisanpassung: 0,1 → 4,99 USAT (03.10.2026)

**Anforderung**: BASTET muss sich selbst tragen, nicht nur im Idealfall
profitabel sein. Kaufmännische Faustregel (nutzerseitig vorgegeben): der
Rechnungsbetrag sollte etwa das Vierfache der eingesetzten Kosten betragen,
um Steuern, Infrastruktur und Investitionskosten mit abzudecken.

**Kalkulationsgrundlage: der Cold-Fall, nicht der Warm-Fall.** "Selbst-
tragend" bedeutet, die Zahlung muss die Kosten auch dann decken, wenn gerade
kein anderer Arm den Wissensbasis-Cache warmhält — genau der Fall, der beim
echten BOTKOV-Verifikationstest eingetreten ist (erster Aufruf überhaupt,
zwangsläufig kalt). Der Warm-Fall (Abschnitt 1.3/1.4) ist der Bonus bei
ausreichend Traffic, nicht die Grundlage für die Preisfindung — sonst wäre
der Endpunkt bei seltenen/unregelmäßigen Aufrufen strukturell defizitär
(siehe Break-even-Rechnung in 1.4: ~14 Aufrufe/Stunde nötig, aktuell ohne
Nutzungsdaten nicht verifizierbar, siehe "Offene Punkte").

**Rechnung:**

| | |
|---|---:|
| Cold-Kosten pro Aufruf (Abschnitt 1.3) | $0,736 |
| × kaufmännischer Faktor 4 | $2,944 |
| Erste Rundung | 3,00 USAT |
| Finale Entscheidung: runder, leichter kommunizierbarer Betrag | **4,99 USAT** |

4,99 USAT entspricht dem ~6,8-fachen der Cold-Kosten (statt nur dem
4-fachen) — mehr Sicherheitsmarge als die Faustregel verlangt, bewusst so
gewählt, weil der Preis auch im Infopaket (Abschnitt 3.1) kommuniziert wird
und "4,99" als Preispunkt klarer kommunizierbar ist als "3,00" plus
Rundungsdiskussion.

**Neue Marge:**

| Szenario | Kosten | Erlös (neu) | **Marge (neu)** |
|---|---:|---:|---:|
| Cold (Worst Case, selbsttragend) | $0,74 | $4,99 | **≈ +575 % ($4,25 Gewinn)** |
| Warm, geteilt (Best Case) | $0,05–0,055 | $4,99 | **≈ +99 % ($4,94 Gewinn)** |

**Umgesetzt**: `lib/x402.ts` (`getPriceAmount()`-Default), README,
`build/phase10-english-expat-bastet.md`. Historische Fakten (der tatsächlich
am 03.10. zum damaligen Preis von 0,1 USAT gezahlte, on-chain verifizierte
BOTKOV-Test) bleiben unverändert dokumentiert — nur die künftig geltende
Preiskonfiguration wurde angehoben.

### 3.1 Infopaket für Kaufentscheidungen (`GET {CONSULT_PATH}`, ohne Zahlung)

Setzt Empfehlung 2.2 aus diesem Dokument um. Der aufrufende Agent trifft die
Kaufentscheidung laut Nutzervorgabe typischerweise **nicht allein**, sondern
bespricht sie mit dem Wallet-Besitzer — das Infopaket ist deshalb bewusst
als Fließtext-taugliche Felder aufgebaut (Begrüßung, Beschreibung, Preis,
Nutzungsmodell, Grenzen), nicht nur als technische Metadaten, damit ein
Agent es direkt an einen Menschen weiterreichen kann.

Kerninhalte (`lib/x402.ts`, `buildInfoPacket()`):
- **Begrüßung + Beschreibung**: was BASTET ist (GdB/MdE/EMR-Orientierung
  für Post-COVID/ME-CFS, englischsprachig, quellenbelegt).
- **`whatYouGet`**: eine vollständige, referenzierte Antwort auf eine Frage.
- **`howToAskAGoodQuestion`** (ergänzt 03.10.2026): aus dem echten Tier-1-
  Fragenkatalog (`lib/triage/questions.ts`) destillierter Leitfaden -
  dieselben Kategorien, die `computeTriage()` (`lib/triage/scoring.ts`)
  tatsächlich auswertet (PEM inkl. Trigger/Schwelle/Latenz/Erholung, Dauer,
  Schmerz, Kognition, Autonomie inkl. objektiver Tests, Schlaf, sonstige
  Symptome, Komorbiditäten, Medikation, Funktionskapazität, Alltag,
  Arbeitsfähigkeit, beruflicher Kontext/BK-3101) - als englischer
  Freitext-Leitfaden statt strukturiertes Formular, weil der x402-Endpunkt
  nur ein einzelnes `question`-Feld entgegennimmt und es anders als im
  Web-Chat-Arm **keine Folgefrage gibt**. Grund: Bei Single-Shot ohne
  Rückfragemöglichkeit entscheidet die Vollständigkeit der einen Frage
  direkt über die Qualität der Antwort - unvollständige Angaben lassen sich
  nicht nachträglich ergänzen, anders als im mehrstufigen Web-Interview.
- **`usageModel`**: explizit klargestellt, dass eine Zahlung **kein Abo und
  keine zeitlich befristete Nutzung** ist — ein Payment = eine Frage = eine
  Antwort, keine laufende Konversation. Das war wichtig zu klären: die
  bestehende Architektur (`lib/expatConsult.ts`) ist Single-Shot ohne
  Session-Zustand, "wie lange man BASTET nutzen kann" ist also korrekt
  beantwortet mit "für eine Antwort", nicht mit einer Zeitdauer.
- **`whatItCanNotDo`**: keine Diagnose, nicht bindend, kein Ersatz für
  ärztliche/anwaltliche Beratung, nur Post-COVID/ME-CFS-Themenbereich, keine
  Datenspeicherung über die eine Anfrage hinaus.
- **`forCallingAgents`**: expliziter Hinweis an den aufrufenden Agenten,
  das Infopaket vor der Zahlung an den Wallet-Besitzer weiterzugeben.

Technisch: `app.get(CONSULT_PATH, ...)` in der Hono-App, **vor**
`paymentMiddleware()` nicht nötig zu platzieren, da `buildRoutes()` nur
`"POST {CONSULT_PATH}"` als geschützte Route deklariert — ein `GET` auf
denselben Pfad matcht die Middleware nicht und läuft frei durch. Lokal
gegen den Dev-Server verifiziert: `GET` liefert `200` mit dem vollständigen
Infopaket, `POST` ohne Zahlung weiterhin `402`.

**Einordnung der Unsicherheit**: Die 179.000-Token-KB-Schätzung (Abschnitt
1.1) ist zeichenbasiert, nicht per `count_tokens` verifiziert, und die
wortbasierte Gegenprobe liegt niedriger (~115.000–125.000). Ein niedrigerer
realer Tokenwert würde die tatsächlichen Kosten UNTER die hier gerechneten
$0,736 drücken — die Marge wäre dann noch komfortabler, nie knapper. Der
Preis wurde also bewusst gegen die konservativere (höhere) Kostenschätzung
gesetzt, nicht gegen die günstigste Annahme.

### 3.1.1 Reale Messung (03.10.2026, Vercel-Logs) — korrigiert die Schätzung nach oben

Vier echte BOTKOV-Testaufrufe kurz hintereinander zeigten in den Vercel-Logs
(`[anthropic:usage] callClaude ...`) durchgehend **`cache_write=0`,
`cache_read=365.735`** (identisch bei allen vier Aufrufen — erwartet, da der
gecachte Inhalt sich zwischen Aufrufen nicht ändert) sowie Output-Längen von
3.207–9.984 Tokens (deutlich über dem angenommenen Arbeitswert von ~1.500).

**Die reale Zahl liegt fast beim Doppelten der 179.000-Token-Schätzung** —
die zeichenbasierte 4-Zeichen/Token-Heuristik hat die Wissensbasis
unterschätzt, nicht überschätzt wie in der Unsicherheits-Einordnung oben
noch für möglich gehalten. Neu gerechnet:

| | Geschätzt (Abschnitt 1.3) | **Real gemessen** |
|---|---:|---:|
| Gecachter Anteil (KB + Rules) | 179.000–180.150 Tok | **365.735 Tok** |
| Warm-Kosten (Cache-Read, $0,20/MTok) | ~$0,0358 | **~$0,073** |
| Cold-Kosten (Cache-Write, $4/MTok) | ~$0,716 | **~$1,463** |
| Output (angenommen vs. real beobachtet 3.207–9.984 Tok) | ~1.500 Tok, ~$0,015 | **$0,032–$0,0998** |
| **Gesamt warm** | $0,051–0,055 | **~$0,11–0,17** |
| **Gesamt cold** | ~$0,736 | **~$1,50–1,56** |

**Konsequenz für den 4,99-USAT-Preis**: Bei den realen Cold-Kosten (~$1,53)
ergibt 4,99 USAT nur noch **~3,3x Marge statt der geforderten 4x** (~69 %
statt ~575 % Marge) — der Preis unterschreitet die eigene 4x-Vorgabe im
Worst Case knapp. Diese Erkenntnis war der unmittelbare Auslöser für das in
Abschnitt 4 beschriebene zweistufige Preismodell (Entscheidung des Nutzers:
Rabattstufe statt pauschaler Preiserhöhung, aus Marketing-Gründen).

Gute Nachricht unabhängig davon: `cache_write=0` bei allen vier Aufrufen
bestätigt, dass der geteilte Cache aus PR #84 in der Praxis tatsächlich
funktioniert — die Frage ist nur, wie oft der Cold-Fall real eintritt
(weiterhin ungemessen, siehe "Offene Punkte").

---

## 4. Zweistufiges Preismodell: Neu- vs. Wiederkehrend-Wallet (03.10.2026)

**Nutzervorgabe**: Statt eines pauschal höheren Preises (der auch gute,
günstig zu bedienende Nachfragen unnötig verteuert) soll der Cache-Vorteil
an den Nutzer weitergegeben werden — einfach verständlich, fair für eine
kleine, heterogene Zielgruppe: **4,99 USAT** für eine neue Wallet,
**0,99 USAT** für eine Folgefrage derselben Wallet innerhalb von
**55 Minuten** seit ihrer letzten Zahlung, wobei jede Zahlung das
55-Minuten-Fenster erneut verlängert.

### 4.1 Warum 55 statt 60 Minuten, und warum pro Wallet statt global

Die Anthropic-Prompt-Cache-TTL ist ein **Sliding Window**: jeder Cache-Read
verlängert sie erneut (bestätigt über den Anthropic-API-Skill,
`shared/prompt-caching.md`: "Traffic is continuous (requests <= TTL apart)
→ every subsequent request hits [the cache]"). Der Cache kühlt nur ab, wenn
eine Lücke **über 1 Stunde** entsteht.

Ursprünglich als global geteilter Systemzustand durchdacht (ein einziger
"zuletzt warm"-Zeitstempel für alle Arme) — das wurde verworfen, weil es
eine neue Wallet bevorzugen könnte (falls zufällig gerade ein anderer Arm
aktiv war) und eine wiederkehrende Wallet benachteiligen könnte (falls seit
Stunden niemand sonst aktiv war). Das **pro-Wallet-Modell** ist dagegen
selbsttragend korrekt: Zahlt Wallet X zum Zeitpunkt T, hat X damit
garantiert selbst den geteilten KB-Cache aufgefrischt; zahlt X erneut vor
T+55min, ist dieser Cache nachweislich noch warm (55 < 60 Minuten TTL) -
unabhängig vom Verhalten aller anderen Nutzer:innen. 55 statt 60 Minuten
ist die Sicherheitsmarge gegen Latenz/Uhrenabweichung.

### 4.2 Protokoll-Hürde: der Server kennt die zahlende Wallet beim 402 noch nicht

`HTTPRequestContext` (die SDK-Struktur, die eine `DynamicPrice`-Funktion
bekommt, siehe 4.3) hat **keine generischen Header** - nur `path`, `method`,
`paymentHeader`. Beim allerersten, unbezahlten Request ist noch keine
Zahlung eingereicht, der Server kennt die anfragende Wallet also nicht.

**Lösung**: Der Client hängt seine eigene Wallet-Adresse als
`?wallet=0x...`-Query-Parameter an. Das ist **kein Vertrauensbeweis**,
sondern reiner Identifikator - der Server entscheidet den Preis
ausschließlich aus seinem eigenen Redis-Stand
(`lib/x402Pricing.ts`), der nur nach einer bereits von der Middleware
**verifizierten** Settlement geschrieben wird (`resourceServer.onAfterSettle()`
in `lib/x402.ts`, liest `context.result.payer` - die echte, kryptographisch
bestätigte Zahleradresse, nicht die Behauptung aus der URL). Eine Wallet
kann sich also nicht in die günstige Stufe hineinlügen: wer fälschlich
`?wallet=<fremde Adresse>` angibt, müsste trotzdem mit der echten Signatur
dieser fremden Wallet bezahlen können, um die Zahlung abzuschließen - ohne
deren privaten Schlüssel scheitert das einfach an der normalen
Signaturprüfung, kein Sonderfall nötig.

### 4.3 Umsetzung

- **`lib/x402Pricing.ts`** (neu): `isReturningWallet(address)` /
  `touchReturningWallet(address)` - Upstash Redis, Key `bastet:x402:wallet:
  {adresse}`, TTL 55 Min. (automatisches Ablaufen übernimmt die
  Fenster-Logik, kein manueller Zeitstempel-Vergleich nötig). Fail-safe:
  ein Redis-Ausfall liefert `false` (-> voller Preis), nie `true`.
- **`lib/x402.ts`**: `price` in `buildRoutes()` ist jetzt eine
  `DynamicPrice`-Funktion (offizieller SDK-Typ aus `@x402/core/http`,
  `(context) => Price | Promise<Price>`) statt eines festen Werts - die
  Middleware ruft sie pro Anfrage neu auf, einmal beim 402-Response-Bau und
  erneut bei der Zahlungsverifikation. `extractWalletHint()` liest den
  `?wallet=`-Parameter sicher (ungültige/fehlende Adresse -> `null` ->
  voller Preis). `resourceServer.onAfterSettle()` schreibt das Fenster nach
  echtem Settlement.
- **`lib/x402.ts`, `buildInfoPacket()`**: `price` zeigt jetzt beide Stufen
  (`newWallet`, `returningWallet`, `returningWindowMinutes`) plus eine
  Anleitung (`howToGetTheReturningPrice`), wie der Rabatt zu bekommen ist.
- **Test-Referenzskript** (`x402-payment-test.mjs`, an den Nutzer verteilt):
  hängt `?wallet=<eigene Adresse>` automatisch an, damit wiederholte
  Testläufe die Rabattstufe mittesten (`NO_WALLET_HINT=1` zum gezielten
  Testen des vollen Preises).
- Lokal verifiziert (Dev-Server, ohne Upstash-Zugang in dieser Sandbox):
  Infopaket zeigt beide Preisstufen korrekt; Request ohne `?wallet=` →
  voller Preis; Request mit `?wallet=` aber nicht erreichbarem Redis →
  sicherer Fallback auf vollen Preis, kein Absturz. Das eigentliche
  Rabatt-Szenario (zwei Zahlungen derselben Wallet < 55 Min. auseinander)
  ist erst gegen die echte Produktions-Redis-Instanz vollständig testbar.
- **Testphase abgeschlossen**: Preise stehen wieder auf den echten Werten
  4,99/0,99 USAT (`lib/x402.ts`-Defaults, `X402_PRICE_*_BASE_UNITS` bleiben
  als Override verfügbar). Das zweistufige Modell wurde mit BOTKOV gegen
  die echte Produktions-Redis-Instanz verifiziert: zweite Zahlung derselben
  Wallet <55 Min. nach der ersten zeigte korrekt den Rabattpreis.

---

## 5. Cache-Warmhalten per zu-/abschaltbarem Vercel Cron Job (geplant, noch nicht umgesetzt)

**Hintergrund**: Der Anthropic-Prompt-Cache auf der Wissensbasis ist global
pro Account, nicht pro Wallet — jede Tier-2-Anfrage, über welchen Arm auch
immer, hält ihn für die nächste Anfrage von irgendwem warm (siehe 4.1).
Das wirkt ausschließlich auf **unsere** Kosten (cache_read $0,20/MTok statt
cache_write $4/MTok bei 1h-TTL), nicht auf den Verkaufspreis — der
Wallet-Rabatt aus Abschnitt 4 bleibt ein komplett separater, pro-Wallet
geführter Zustand in `lib/x402Pricing.ts` und ist von der Anthropic-
Cache-Warmhaltung unabhängig.

**Verworfen**: BOTKOV (oder ein anderer zahlender Agent) alle ~50 Minuten
eine echte x402-Zahlung auslösen zu lassen, nur um den Cache warmzuhalten.
Unnötig teuer und fragil - echtes USAT, Facilitator-Abhängigkeit,
Wallet-Guthabenrisiko - für einen Effekt, der serverseitig ganz ohne
Zahlung erreichbar ist.

**Geplanter Ansatz**: Ein Vercel Cron Job, der die interne Pipeline
(`buildSystemBlocks` + `callClaude`, wie in `lib/expatConsult.ts`) direkt
aufruft - **ohne** über die x402-Payment-Middleware zu laufen, also ohne
Zahlung, ohne Wallet. Intervall ≤55 Minuten, konsistent mit dem
Rabattfenster aus Abschnitt 4.1.

- **Zu-/abschaltbar**: kein dauerhaft fest verdrahteter Cron, sondern über
  einen Env-Flag (z.B. `KEEP_WARM_CRON_ENABLED`) steuerbar, den der
  Endpunkt selbst prüft - ein deaktivierter Cron läuft zwar weiter (Vercel
  Cron Schedules sind nicht laufzeit-konfigurierbar ohne Redeploy), die
  Handler-Funktion antwortet dann aber sofort ohne jeden Anthropic-Call.
  So lässt sich der Mechanismus jederzeit ohne Code-Änderung an-/ausschalten
  (nur eine Env-Var in Vercel umstellen).
- **Sicherung des Endpunkts**: wie bei Vercel-Cron-Routen üblich per
  `CRON_SECRET`-Header-Check, damit der Endpunkt nicht von außen beliebig
  getriggert werden kann (jeder Aufruf kostet echtes Geld).
- **Kostenabschätzung**: ein Ping kostet ca. 0,07-0,15 $ (cache_read auf
  die volle Wissensbasis + minimaler Output). Bei 24/7-Betrieb alle 50 Min.
  (~29 Pings/Tag) macht das ~60-90 $/Monat - **nur sinnvoll für gezielte
  Zeitfenster** (Demo-Tag, Hackathon-Judging, Marketing-Push), nicht als
  Dauerlösung bei der aktuell geringen, unregelmäßigen Last. Bei
  ausreichend dichtem echtem Traffic hält ohnehin schon die organische
  Nutzung den Cache warm, ganz ohne Zusatzkosten.
- **Noch offen / nicht Teil dieser Planung**: konkreter Dateiname/Pfad des
  Cron-Handlers, `vercel.json`-Cron-Eintrag, genaue Entscheidung, wann der
  Flag angeschaltet wird. Erst umsetzen, wenn ein konkreter Anlass
  (anstehender Demo-/Judging-Termin) feststeht.

---

## Offene Punkte

- Exakte Token-Zahl der Wissensbasis per `count_tokens` verifizieren (hier
  nur zeichenbasiert geschätzt, mittlerweile durch die reale Messung in
  3.1.1 — 365.735 Tokens gecacht — weitgehend überholt; `count_tokens`
  würde nur noch den exakten KB-Anteil separat von den Rules-Block-Tokens
  trennen).
- Celo-Builders-Registrierung + `attributionTag`-Einbau (Abschnitt 1.5) —
  höchste Priorität vor dem Submission-Fenster (06.10.).
- Bazaar-Registrierung (Abschnitt 2.1) — abhängig von Rückmeldung, ob
  gewünscht.
- Cache-Warmhalten per Vercel Cron Job (Abschnitt 5) — nur geplant, noch
  nicht gebaut; Umsetzung erst bei konkretem Anlass (Demo-/Judging-Termin).
