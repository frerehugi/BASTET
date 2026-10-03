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

## 3. Preisanpassung: 0,1 → 3,0 USAT (03.10.2026)

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
| Gerundet | **3,00 USAT** |

**Neue Marge:**

| Szenario | Kosten | Erlös (neu) | **Marge (neu)** |
|---|---:|---:|---:|
| Cold (Worst Case, selbsttragend) | $0,74 | $3,00 | **≈ +306 % ($2,26 Gewinn)** |
| Warm, geteilt (Best Case) | $0,05–0,055 | $3,00 | **≈ +98 % ($2,95 Gewinn)** |

**Umgesetzt**: `lib/x402.ts` (`getPriceAmount()`-Default), README,
`build/phase10-english-expat-bastet.md`. Historische Fakten (der tatsächlich
am 03.10. zum damaligen Preis von 0,1 USAT gezahlte, on-chain verifizierte
BOTKOV-Test) bleiben unverändert dokumentiert — nur die künftig geltende
Preiskonfiguration wurde angehoben.

**Einordnung der Unsicherheit**: Die 179.000-Token-KB-Schätzung (Abschnitt
1.1) ist zeichenbasiert, nicht per `count_tokens` verifiziert, und die
wortbasierte Gegenprobe liegt niedriger (~115.000–125.000). Ein niedrigerer
realer Tokenwert würde die tatsächlichen Kosten UNTER die hier gerechneten
$0,736 drücken — die Marge wäre dann noch komfortabler, nie knapper. Der
Preis wurde also bewusst gegen die konservativere (höhere) Kostenschätzung
gesetzt, nicht gegen die günstigste Annahme.

---

## Offene Punkte

- Exakte Token-Zahl der Wissensbasis per `count_tokens` verifizieren (hier
  nur zeichenbasiert geschätzt, 179.000 als konservativer Arbeitswert).
- `usage.cache_read_input_tokens`/`cache_creation_input_tokens` tatsächlich
  loggen, um die Warm/Cold-Verteilung real zu messen statt anzunehmen.
- Celo-Builders-Registrierung + `attributionTag`-Einbau (Abschnitt 1.5) —
  höchste Priorität vor dem Submission-Fenster (06.10.).
- Bazaar-Registrierung (Abschnitt 2.1) — abhängig von Rückmeldung, ob
  gewünscht.
