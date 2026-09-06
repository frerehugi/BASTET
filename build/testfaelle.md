# BASTET — Testfälle für die Vorbegutachtung

Sammlung realistischer Test-Prompts für die manuelle Stichproben-Prüfung der GdB/MdE-Auswertungen (Betroffenen-Arm `/` und Ärzte-Arm `/doc`), siehe `build/claude-code-buildplan.md`, Abschnitt "Nach dem Hackathon: was das Audit nicht abdeckt".

Jeder Fall ist bewusst als Rohtext notiert, so wie ihn eine betroffene Person im Chat eintippen könnte — nicht vorstrukturiert, damit das Interview selbst mitgetestet wird (Nachfragen, Turn-Budget, ob PEM/Dauer/Berufsbezug erfragt werden).

## Fall: Krankenschwester, beruflicher Zusammenhang (BK-3101-Kandidat)

> Krankenschwester, 42, Covid infekt 2022 auf der Arbeit im Krankenhaus, BG gemeldet, ein paar wochen krank, später immer wieder krank, schwindel, kopfschmerzen, schlechter schlaf, schlechte erholung, behandlung über hausarzt

**Antwort auf Nachfrage (PEM / Alltag / BG-Stand):**

> ja, nach starker belastung werde ich immer krank. das dauert manchmal mehrere wochen. Der Alltag ist schwierig, ich gehe abends um am wochenende kaum raus weil ich die erholung brauche, einkaufen geht manchmal, danach aber nichts mehr. nein, von der BG habe ich weiter nichts gehört.

**Antwort auf weitere Nachfrage (Arbeitsfähigkeit / BK-3101-Kenntnisstand):**

> Ja, ich arbeite mit halber Stelle. mehr geht nicht. Geld ist deswegen immer knapp. von einer BK 3101 weiss ich nichts

**Worauf beim Review achten:**
- Wird der berufliche Zusammenhang (Klinik, gemeldet bei der BG) korrekt aufgegriffen und führt zu einer **MdE-Einschätzung**, nicht nur zu "nicht einschlägig"?
- Wird nach PEM (post-exertionelle Malaise) gezielt nachgefragt, da im Rohtext nicht explizit genannt ("immer wieder krank" ist kein eindeutiges PEM-Signal)? Die Nachfrage-Antwort bestätigt PEM klar (Verschlechterung über Wochen nach Belastung) — wird das auch so benannt und referenziert (CCC-PEM-Kriterium)?
- BG-Status ist nuanciert: gemeldet, aber seit der Meldung **keine Rückmeldung** — das ist etwas anderes als "nicht gemeldet" oder "anerkannt". Erkennt die Auswertung diesen Zwischenstand korrekt (MdE-Einschätzung als Orientierung möglich, aber Rentenanspruch setzt eine erfolgte BK-3101-Anerkennung voraus) statt es pauschal als "nicht einschlägig" oder als "anerkannt" zu behandeln?
- Alltagsangaben (abends/Wochenende kaum raus, Einkaufen erschöpft sie vollständig) sind Bell-Score-relevant — fließen sie sichtbar in die GdB-Begründung ein?
- Halbtagsstelle als reduzierte Arbeitsfähigkeit ist ein weiteres GdB-relevantes Signal (Fatigue/Alltagsfunktion-Kategorie) — wird es aufgegriffen?
- Widerspruch/Unschärfe zwischen "BG gemeldet" (erste Antwort) und "von einer BK 3101 weiß ich nichts" (diese Antwort): realistisch, da Betroffene oft nur wissen, dass "etwas bei der BG lief", nicht die konkrete BK-Ziffer. Erkennt die Auswertung, dass eine Meldung bei der BG nicht automatisch eine bekannte/anerkannte BK-3101 bedeutet, und behandelt den MdE-Teil entsprechend vorsichtig-orientierend (z. B. Hinweis, dass der BK-3101-Status bei der zuständigen BG zu erfragen ist), statt fälschlich "nicht einschlägig, da keine BK-3101" zu schreiben?
- Wird die Dauer (≥6 Monate seit 2022) korrekt erkannt?
- Zieht die Auswertung passende Kalibrierungsanker heran (z. B. Schwindel/Kopfschmerz-Fälle aus `schlaf-schwindel-kognitiv-faelle.md`, BK-3101-Kausalitätsstufen aus `unfallversicherung-mde.md`) statt nur pauschal auf 18.4/3.7 zu verweisen?
- Bleibt die Antwort vollständig (GdB **und** MdE **und** Referenzen-Block), auch bei ausführlicher Begründung — siehe Commit `b151fb0` (Token-Budget-Fix vom 05.09.2026).

## Fall: Physiotherapeutin, BG-anerkannte Infektion + Blutdruckproblematik

Bisher nur als Verweis in `build/claude-code-buildplan.md` dokumentiert ("siehe den Physiotherapeut:in-Fall"), Wortlaut/Eingaben nicht überliefert — nur folgende Baseline-Auswertung (vor Phase 3, Wissensbasis-Sync) liegt vor, erhalten am 06.09.2026 als Vergleichsgrundlage. Eingaben, die zu dieser Auswertung geführt haben (rekonstruiert aus dem Text): COVID-19-Infektion 2022, BG-anerkannt, Tätigkeit als Physiotherapeutin in Geriatrie/Intensiv; seit über 3 Jahren durchgehend PEM (Verschlechterung 1–2 Tage nach Belastung, Erholung über Wochen, nie vollständig erholt); Erschöpfung im Schnitt 7/10, Schübe 9–10/10; Brain Fog; medikamentös mehrfach behandlungsbedürftige Blutdruckproblematik; aktuell 80% Erwerbstätigkeit (angepasst); BK-3101-Anerkennung des heutigen Post-COVID-Zustands (nicht nur der Akutinfektion) noch offen.

**Baseline-Auswertung (vor Phase 3):**

```
GdB: 50–60
  Basis: VersMedV 18.4 analog 3.7 [3], gestützt durch SG Speyer 2025 (GdB 50
  bei organisch bedingter Fatigue/Brain Fog/Schwindel) [5]. Mehrfach
  behandlungsbedürftige Blutdruckproblematik als eigenständige, nicht nur
  leichte autonome/kardiovaskuläre Komponente gewertet (Kapitel 9,
  Leistungslogik) [6][8]. Medikation, die den aktuellen Befund kontrolliert,
  wurde ausdrücklich NICHT gegen eine höhere Einstufung gewertet, sondern als
  Hinweis auf die unbehandelte Schwere [8]. Gesamt-GdB-Prinzip nach SG Aurich
  (unabhängige Beeinträchtigungen verstärken sich stärker als überlappende)
  spricht für die obere Spanne [4].

MdE: einschlägig, mit offenem Punkt
  BG-Anerkennung der Akutinfektion liegt vor [7]; ob der HEUTIGE Post-COVID-
  Zustand als BK-3101-Unfallfolge (haftungsausfüllende Kausalität) anerkannt
  ist, bleibt offen [9]. Geschätzte Spanne falls anerkannt: 20–30%, orientiert
  an einem dokumentierten Fall mit MdE 30% (Fatigue + leichte kognitive
  Störung + reaktive psychische Komponente) [9]. Nächster Schritt: BK-3101-
  Anerkennungsstatus bei der BG klären, Dokumentation empfohlen (AU-Zeiten
  seit 2022, Reha-Bericht, Medikamentenplan, Symptomtagebuch).

Referenzen: [1] CCC/PEM (postcovid-mecfs.md) [2] §2 Abs.1 SGB IX + VersMedV
  Teil A 1.3 (Dauer) [3] VersMedV 18.4 i.V.m. 3.7 [4] SG Aurich S 4 SB 154/21
  [5] SG Speyer, Urteil v. 03.06.2025, Az. S 12 SB 318/23 [6] VersMedV Kap. 9
  (Herz/Kreislauf) [7] Eigenangabe: BG-Anerkennung [8] CCC-Fragenkatalog,
  Abschnitt Medikation [9] SGB VII §56, BK-3101 + dokumentierter MdE-30-Fall
```

**Worauf beim Vergleich nach Phase 3 achten:**
- Wird SG Speyer (2025) weiterhin korrekt als Post-COVID-spezifischer Vergleichsfall herangezogen (kommt aus `symptomliste-gdb-mde-abgleich.md`, die neu synchronisierte Datei)?
- Ändert sich die GdB-Spanne (50–60) durch die aktualisierten Dateien, insbesondere durch genauere Kalibrierung zur kardiovaskulären/autonomen Komponente?
- Bleibt die Argumentationslinie "Medikation maskiert Schwere, nicht Grund für niedrigere Einstufung" erhalten — das ist ein inhaltlich wichtiger, nicht offensichtlicher Punkt?
- Bleiben GdB **und** MdE **und** Referenzen-Block vollständig, auch mit dem größeren Wissensbasis-Umfang nach Phase 3?

**Nachlauf-Ergebnis (06.09.2026, nach Phase 3+4, per `/api/chat` direkt getestet):**

```
GdB: 50–60 (identisch zur Baseline)
MdE: einschlägig mit offenem Kausalitätspunkt, 20–30% falls anerkannt (identisch)
Referenzen: 12 statt 9 — neu u.a. [5] LSG Baden-Württemberg, Az. L 6 SB 1119/24
  ("Long-Covid-Syndrom, kein gesonderter Teil-GdB") und [6] VersMedV 3.1.1
  Hirnschäden-Globalfunktion als Kalibrierungsanker für die PEM/Fatigue-Schwere
```

Fazit: Kernzahlen (GdB- und MdE-Spanne) blieben stabil, die Begründung wurde durch
die Phase-3-Dateien sichtbar reichhaltiger (mehr Kalibrierungsanker, ein weiterer
Gerichtsfall) — genau das gewünschte Ergebnis: Anreicherung statt Verwässerung.

**Dabei gefundener und behobener Bug**: Der erste Testlauf nach Phase 3 brach
mitten im REFERENZEN-Block ab (`max_tokens` 4096 reichte nicht mehr, weil die
Antworten durch die größere Wissensbasis länger wurden). Behoben durch Anhebung
auf 8192 (Commit `6494e40`) plus eine harte Absicherung: `lib/anthropic.ts` wirft
jetzt einen Fehler statt eine bei `stop_reason: max_tokens` abgeschnittene Antwort
stillschweigend als Erfolg zurückzugeben (Commit `5dcef0e`) — eine unvollständige
GdB/MdE-Einschätzung darf nie unbemerkt ausgeliefert werden.

## Fall: Physiotherapeutin — Nachlauf nach Einführung des dritten Blocks (EMR, 06.09.2026)

Gleicher Testfall wie oben, per `/api/doc` direkt getestet, nachdem GdB/MdE um
einen dritten, eigenständigen Block zur Erwerbsminderungsrente (EMR, SGB VI)
sowie um eine Würdigung objektiver Testinstrumente (6-Minuten-Gehstrecke,
Handkraftmessung, neuropsychologische Testung) ergänzt wurde (Commit `5602dbc`).

**Sofort gefundener und behobener Bug**: Der erste Testlauf nach dieser
Erweiterung brach erneut mit `stop_reason: max_tokens` ab — diesmal bei den
zuvor ausreichenden 8192 Tokens, weil der zusätzliche EMR-Block spürbar mehr
Platz braucht als GdB und MdE allein. Behoben durch Anhebung auf 16000 Tokens
plus `maxDuration = 60` auf allen drei API-Routen (`/api/chat`, `/api/doc`,
`/api/telegram`), damit die längere Generierung nicht am Standard-Timeout der
Serverless Function scheitert (Commit `47972ec`). Die harte `max_tokens`-
Absicherung aus `lib/anthropic.ts` hat den Abbruch wie vorgesehen laut statt
still gemeldet.

**Ergebnis nach dem Fix:**
```
GdB: 50–70 (etwas breiter als die bisherige Baseline 50–60, u. a. durch
  Einbezug von LSG Baden-Württemberg L 6 SB 1119/24 und eine Objektivierende-
  Evidenz-Anmerkung zu fehlenden Testinstrumenten)
MdE: einschlägig dem Grunde nach, Anerkennung des heutigen Post-COVID-Zustands
  noch offen; orientierende Spanne für den Anerkennungsfall: 30–40 %
EMR: eher ≥6 Std. (keine Erwerbsminderung), mit Vorbehalt — aus der
  angepassten 80%-Tätigkeit rückgeschlossen, ausdrücklich unter Hinweis, dass
  die Prüfung dem allgemeinen Arbeitsmarkt gilt, nicht der angepassten
  Stelle; Bell-Score-Schätzung (ca. 40–50) und Empfehlung einer eigenständigen
  sozialmedizinischen Begutachtung nach DRV-Grundsätzen
Referenzen: 12, vollständig aufgelöst, inkl. neuer EMR-spezifischer Quellen
  ([11] DRV-Begutachtungsleitfaden, [12] Scheibenbogen et al., Die Ärztliche
  Begutachtung 2025)
```

Fazit: Alle drei Blöcke (GdB, MdE, EMR) sowie der vollständige REFERENZEN-Block
erscheinen zuverlässig, auch bei dieser inhaltlich dichtesten bisher getesteten
Fallkonstellation. Die EMR-Einordnung erkennt korrekt den Unterschied zwischen
der individuell angepassten Tätigkeit der Patientin und dem für SGB VI
maßgeblichen allgemeinen Arbeitsmarkt, statt die 80%-Tätigkeit unreflektiert
als Beleg fehlender Erwerbsminderung zu werten — genau die Nuance, die bei der
Fachprompt-Formulierung beabsichtigt war.
