# MiniPay für BASTET — Machbarkeitsanalyse (Stand 03.10.2026)

Reine Analyse auf Anfrage ("ganz in Ruhe überlegen, wie wir BASTET
unkompliziert MiniPay-Nutzer:innen zugänglich machen") — keine Umsetzung in
diesem Dokument. Grundlage: offizielle Celopedia-Skill-Referenzen
(`minipay-guide.md`, `minipay-app-fit.md`, `minipay-requirements.md`), nicht
aus dem Gedächtnis geraten.

---

## 1. Der zentrale Befund: x402 lässt sich NICHT direkt in MiniPay einbetten

MiniPay-Wallets unterstützen laut offizieller Doku **kein Message Signing**:

> "No message signing — `personal_sign` and `eth_signTypedData` are not
> supported." (`minipay-guide.md`)

BASTETs bestehender x402-Zahlungsweg (`lib/x402.ts`, die "exact"-EVM-Scheme)
basiert aber genau darauf: EIP-3009 `transferWithAuthorization` wird per
`eth_signTypedData_v4` signiert — exakt das Verfahren, das BOTKOVs Testskript
(`x402-payment-test.mjs`) nutzt. **Ein MiniPay-Nutzer könnte diese Signatur
technisch gar nicht erzeugen** — das ist in der App-Fit-Scorecard sogar als
expliziter Blocker benannt:

> "Requires `personal_sign` or `eth_signTypedData` — **this is a hard
> technical block; the app cannot function in MiniPay**." (`minipay-app-fit.md`,
> Dimension D)

**Konsequenz**: Der bestehende x402-Endpunkt (`/api/x402/consult`) bleibt
unverändert für zahlende AI-Agenten (sein eigentlicher Zweck). Für MiniPay
braucht es einen **zweiten, parallelen Zahlungsweg** — keine Wiederverwendung
der x402-Facilitator-Infrastruktur, sondern eine direkte On-Chain-Überweisung:

```typescript
// Muster aus minipay-guide.md — eth_sendTransaction, KEINE Signatur
const data = encodeFunctionData({
  abi: ERC20_ABI,
  functionName: "transfer",
  args: [BASTET_WALLET, parseUnits(PRICE, decimals)],
});
const txHash = await walletClient.sendTransaction({
  account: address,
  to: USDT_ADDRESS, // USDT ist für MiniPay PFLICHT, nicht nur USAT
  data,
  feeCurrency: USDT_ADDRESS, // CIP-64 Fee Abstraction, Nutzer zahlt Gas in Stablecoin
});
```

BASTETs Backend müsste diese Transaktion dann selbst verifizieren (Hash vom
Frontend entgegennehmen, per RPC/Blockscout auf Empfänger+Betrag+Asset
prüfen) — ein neuer, schlanker Verifikationspfad, **nicht** der x402-
Facilitator. Nebeneffekt: Der Nutzer zahlt hier selbst (minimales) Gas in
Stablecoin, anders als bei x402, wo der Facilitator das Gas sponsert.

---

## 2. App-Fit-Scorecard (ehrlich, nicht beschönigt)

Offizielles Scoring-Raster aus `minipay-app-fit.md`, 5 Dimensionen à 0–2:

| Dimension | Score (roh, x402-Endpunkt 1:1 reingepackt) | Score (nach Redesign, s. Abschnitt 3) | Begründung |
|---|---:|---:|---|
| **A. Stablecoin-nativ** | 2 | 2 | Kernwert ist eine Stablecoin-Zahlung — passt direkt |
| **B. Kurze Session (≤60s)** | 0 | **2 (nach Redesign)** | Der `howToAskAGoodQuestion`-Leitfaden verlangt ~13 Themenblöcke als Freitext — das Gegenteil von "≤3 Taps". Siehe Abschnitt 3 für die Lösung |
| **C. Lokaler Markt-Fit** | 0–1 | 0–1 (ungelöst) | MiniPays Kernmärkte sind Global South (Nigeria, Kenia, Brasilien, Philippinen...); BASTETs Thema ist **deutsches** Sozialrecht. Siehe Abschnitt 4 — das ist die eigentlich offene Frage, keine technische |
| **D. Ohne `personal_sign`** | 0 (harter Block) | **2 (nach Redesign)** | Siehe Abschnitt 1 — lösbar, aber nicht automatisch |
| **E. Kategorie-Lücke** | 2 | 2 | "Pay AI as you go": **0 Apps aktuell gelistet**, von Celo selbst explizit als "🟢 High"-Chance markiert |

**Roh-Summe: 4–5/10 (Tier 3, "vor Weiterbau validieren")** — ohne Redesign
kein automatischer Fit. **Mit dem Redesign aus Abschnitt 3: 7–8/10 (Tier 2,
"bauen, verbleibende Lücke schließen")** — die einzige verbleibende offene
Frage ist C (Marktfit), die kein Code-Problem ist, sondern eine
strategische Entscheidung.

---

## 3. Die Lösung für B (Session-Länge) liegt bereits im Repo

Der naheliegende, aber falsche Reflex wäre: den `question`-Freitext aus dem
x402-Flow 1:1 in ein MiniPay-Eingabefeld packen. Das scheitert an Dimension B
(Freitext-Paragraph auf einem Budget-Android-Screen mit 3G-Verbindung ist das
Gegenteil eines "≤3-Tap"-Flows) UND macht genau das Qualitätsproblem wieder
auf, das `howToAskAGoodQuestion` im x402-Infopaket lösen sollte (unvollständige
Fragen → schwache Antworten).

**Bessere Lösung**: Die bereits gebaute, bewährte **Tier-1-Fragenstruktur**
(`lib/triage/questions.ts`, `app/TriageFlow.tsx`) ist strukturell exakt das,
was MiniPay will — kurze Multiple-Choice-Schritte statt eines langen
Freitexts. Sie deckt dieselben Kategorien ab, die `howToAskAGoodQuestion` als
Freitext-Checkliste für Agenten formuliert (PEM, Dauer, Schmerz, Kognition,
Arbeitsfähigkeit, beruflicher Kontext etc.) — nur eben als geführter
Tap-Flow statt als Paragraph. Eine MiniPay-Variante würde also:

1. Die Zahlung VOR dem Start einsammeln (Direktüberweisung, siehe
   Abschnitt 1) — kein Freitext nötig, nur Tap-to-pay.
2. Danach durch eine **englische Version** des Tier-1-Fragenkatalogs führen
   (gibt es noch nicht — `lib/triage/questions.ts` ist komplett Deutsch,
   müsste für diesen Kanal übersetzt werden, analog zu `lib/expatConsult.ts`
   für die Antwort-Seite).
3. Die gesammelten Antworten dann wie in `lib/chat.ts`
   (`answersToContextText()`) in den Consult-Prompt einspeisen — dieselbe
   Pipeline wie der deutsche Web-Chat-Arm, nur mit MiniPay statt Payment-
   Challenge am Anfang.

Das ist kein neues UX-Konzept — es ist die Wiederverwendung des bereits
produktionsreifen Tier-1-Bausteins für einen dritten Kanal (nach Web-Chat
und Doc-Arm), nur mit MiniPay-Zahlung statt kostenlosem Zugang davor.

---

## 4. Die eigentlich offene Frage: wer in MiniPays Märkten braucht deutsches Sozialrecht?

Das ist keine technische Frage, und ich beantworte sie hier bewusst nicht
selbst, sondern lege die Overleg offen:

- MiniPays Nutzerbasis sitzt laut App-Fit-Doku primär in Nigeria, Kenia,
  Uganda, Ghana, Südafrika, Brasilien, Kolumbien, Philippinen — nicht in
  Deutschland.
- BASTETs Zielgruppe für den englischen Arm (laut
  `build/phase10-english-expat-bastet.md`) sind **englischsprachige Expats,
  die bereits in Deutschland leben** und mit deutscher Bürokratie zu tun
  haben.
- Eine plausible Schnittmenge: Menschen aus genau diesen Ländern, die nach
  Deutschland ausgewandert sind (Care-/Gesundheitsberufe, Faktor für
  BK-3101 im eigenen Wissensbestand!), ihre MiniPay-Wallet aber von zuhause
  mitgenommen haben, weil Familie/Rücküberweisungen dort weiterlaufen. Das
  ist aber eine Annahme, keine verifizierte Zahl — anders als bei den
  Preis-/Cache-Fragen vorhin habe ich hier keine Methode, das ohne
  Marktdaten zu verifizieren.
- Alternative Lesart: MiniPay wäre für **Produkt 2** (Telegram-Kanal)
  interessanter als Vertriebskanal-Gedanke, nicht unbedingt als primäre
  Zahlungsschiene für das deutsche Sozialrecht-Thema selbst.

**Empfehlung, falls weiterverfolgt**: Vor dem Bauen die Celo-Discord-
Office-Hours oder ein kurzes Community-Feedback nutzen (so wie
`minipay-app-fit.md` es für Tier-3-Scores explizit empfiehlt), um zu
klären, ob diese Zielgruppen-Schnittmenge real und groß genug ist — nicht
raten.

---

## 5. Warum MiniPay trotzdem strukturell attraktiver sein könnte als die Produkt-2-Planung

`build/phase10-english-expat-bastet.md` hatte für den menschlichen Kanal
(Produkt 2) bewusst eine **externe Checkout-Seite statt In-App-Payment**
gewählt — wegen der Apple/Google-IAP-Regel-Problematik (Telegram-Bot-ToS
§6.2, Reader-App-Ausnahme, "kein hundertprozentig sicherer Befund").

Eine MiniPay-Mini-App läuft **nicht** durch Apples/Googles App-Store-Review
— sie ist eine Webseite im MiniPay-eigenen WebView, mit eigenem,
celo-spezifischem Review-/Whitelisting-Prozess (Abschnitt 6). Die ganze
IAP-Unsicherheit, die Produkt 2 so vorsichtig gemacht hat, **entfällt hier
strukturell**. Das ist ein echter Vorteil, unabhängig von der
Marktfrage aus Abschnitt 4 — zahlende Nutzer:innen zahlen direkt im Wallet,
kein Umweg über eine externe Checkout-Seite nötig.

---

## 6. Submission-Prozess (Kurzüberblick, Details bei Bedarf)

Zweistufig laut `minipay-requirements.md`:

1. **Stufe 1 — öffentliches Intake-Formular** (`minipay.to/mini-apps`) —
   erste Kontaktaufnahme, führt zu einem Call mit dem MiniPay-Team.
2. **Stufe 2 — Readiness-Formular** (nach dem Call) — 11-Punkte-Checkliste:
   UI-Textregeln (siehe Verbotsliste unten), 360×640-Mindestauflösung,
   PageSpeed-Score, ToS/Privacy/About/How-to-Use-Seiten, 24h-SLA,
   **Whitelisting-Integrität** (nach Listing sind Contract-Adressen,
   Methodensignaturen, Parameter und URLs eingefroren — eine spätere
   Änderung bricht die Produktion, ohne dass es außerhalb MiniPays
   auffällt), Dependency-Security.

**Harte, in Code erzwingbare Regeln** (zusätzlich zu Abschnitt 1):
kein CELO in der UI, keine Wallet-Adresse anzeigen/kopieren/teilen (auch
nicht gekürzt), kein "Withdraw to address"-Feld, USDT-Pflicht, Guthaben-
Check gegen Betrag+Gebühr statt nur Betrag, verbotene UI-Begriffe ("Gas" →
"Network fee", "Crypto" → "Stablecoin" usw.).

---

## 7. Fazit und Vorschlag für den nächsten Schritt

**Technisch machbar, aber kein Ein-Zeilen-Wrapper um den bestehenden
x402-Endpunkt** — braucht einen eigenen, einfacheren Zahlungsweg
(Direktüberweisung statt EIP-3009-Signatur) und eine eigene, englische
Tier-1-Fragenflow-Variante statt des Freitext-`question`-Felds. Beides baut
auf bereits vorhandenen, bewährten Bausteinen auf (`lib/triage/*`,
`lib/expatConsult.ts`-Muster) — kein Neuland, aber auch keine Nachmittags-
Aufgabe.

**Die Kategorie-Chance ist real** (0 Wettbewerber in "Pay AI as you go",
von Celo selbst als Opportunity markiert) — **die Marktfrage aus Abschnitt
4 ist der eigentliche Showstopper-Kandidat**, nicht die Technik.

Mein Vorschlag, bevor hier Code entsteht: erst Abschnitt 4 klären (Celo-
Community-Feedback oder eigene Einschätzung, ob die Zielgruppen-Schnittmenge
trägt) — danach entscheiden, ob MiniPay als dritter Kanal (neben x402 für
Agenten, Telegram+Checkout für Produkt 2) gebaut wird, oder ob die Energie
woanders besser aufgehoben ist.
