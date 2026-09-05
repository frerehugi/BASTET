# Vorbegutachtungs-Interview: Interaktionsdesign & System-Prompt (Post-COVID/ME-CFS-MVP)

Kernfunktion des Produkts, ausgearbeitet auf Basis deiner Vorgaben: keine Datenspeicherung (Sitzung ist flüchtig), Ausgabe mit konkreter Spanne UND ausführlicher, textstellenbelegter Begründung.

## 1. Architektur-Konsequenz der "keine Speicherung"-Entscheidung

Vereinfacht das MVP erheblich: **kein Patientendatenspeicher nötig.** Der gesamte Chatverlauf lebt nur im Kontext des laufenden Gesprächs (Client hält die Historie, z. B. im Browser-Tab-Speicher; jede Anfrage an die Core-API enthält den vollständigen bisherigen Verlauf; das Backend selbst persistiert nichts Patientenbezogenes). Einzig die **Wissensbasis** (VersMedV-Auszüge, CCC-Kriterien, Urteile) ist serverseitig persistent — das sind keine personenbezogenen Daten.

Damit entfällt für das MVP: Consent-Management für Datenspeicherung, Löschkonzept, Auftragsverarbeitungsvertrag mit einem DB-Hoster. Muss trotzdem rein: ein knapper Datenschutzhinweis, der genau das erklärt ("Ihre Angaben werden nicht gespeichert, verlassen mit Schließen des Chats den Server").

## 2. Interview-Flow

Ziel: strukturiert genug, um alle bewertungsrelevanten Dimensionen zu erfassen, aber als natürliches Gespräch geführt — nicht als starres Formular, da die Zielgruppe oft kognitiv beeinträchtigt ist (Brain Fog) und ein 40-Felder-Formular abschreckend wirkt.

**Phase 0 — Zwei Pflichtschritte vor jeder inhaltlichen Frage, in dieser Reihenfolge:**
1. **Speicherhinweis zuerst**, unmissverständlich und ohne Fachjargon: "Dieser Chat wird nicht gespeichert. Mit Schließen des Fensters sind Ihre Angaben unwiderruflich weg."
2. **Diagnose-Gate als allererste inhaltliche Frage**: "Ist bei Ihnen ein Post-COVID-Syndrom bzw. ME/CFS bereits ärztlich diagnostiziert bzw. gesichert?"
   - **Ja** → weiter mit Phase 1/2 wie unten beschrieben.
   - **Nein / unklar / in Abklärung** → zwingender Hinweis, bevor es weitergeht: *"Dies ist keine medizinische Beratung und kann keine Diagnose stellen oder ersetzen. Ohne gesicherte Diagnose ist eine ärztliche Untersuchung erforderlich."* Danach der Person die Wahl lassen, nicht hart abbrechen: entweder jetzt eine ärztliche Abklärung anstoßen (mit Verweis auf Long-COVID-Ambulanzen/Hausarzt) oder — falls gewünscht — trotzdem eine **rein orientierende** Einschätzung erhalten, die im Output zusätzlich als "Diagnose nicht gesichert" markiert wird und entsprechend vorsichtiger formuliert ist.

**Phase 1 — Einstieg & Rahmen setzen** (nur, wenn Diagnose-Gate durchlaufen)
- Offene Eingangsfrage: "Erzählen Sie mir in eigenen Worten, was seit wann bei Ihnen los ist."

**Phase 2 — Geleitetes Nachfragen (KI führt aktiv, nicht Frage-Antwort-Batterie)**
Die KI leitet aus der freien Schilderung ab, welche CCC-/VersMedV-Dimensionen noch fehlen, und fragt gezielt nach — orientiert an `postcovid-mecfs.md` und `nervensystem-psyche-herz-gdb.md`:
- PEM (zwingendes Leitsymptom): Gibt es eine verzögerte Verschlechterung nach Belastung? Wie lange dauert die Erholung?
- Fatigue-Ausprägung im Alltag (Bell-Score-Logik: was ist noch möglich, was nicht mehr)
- Schlaf, Schmerzen, kognitive Symptome, autonome Symptome (je CCC-Kategorie mindestens grob abfragen)
- Dauer der Beschwerden (≥ 6 Monate? — harte GdB-Voraussetzung)
- Soziale/berufliche Auswirkungen (für 3.7-Analogbewertung: ist Berufstätigkeit gefährdet? Familiäre/soziale Folgen?)
- Falls genannt: beruflicher Zusammenhang (Gesundheitsdienst, Pflege, Labor) → Hinweis auf BK-3101-Relevanz
- Falls genannt: pulmonale/kardiale Beteiligung → Zusatzabfrage Richtung Kapitel 8/9 statt nur 3.7/18.4

**Phase 3 — Zusammenfassung zur Bestätigung**
Bevor die Auswertung erstellt wird: kurze Zusammenfassung des Verstandenen, Nachfrage "Habe ich das richtig erfasst? Fehlt etwas Wichtiges?" — reduziert Fehlinterpretationen und gibt der Person Kontrolle.

**Phase 4 — Auswertung (Output-Template siehe Abschnitt 3)**

**Phase 5 — Weiterführende Informationen** (optional, auf Nachfrage oder am Ende angeboten, nicht aufgedrängt)
- Wie eine GdB-Antragstellung abläuft (Versorgungsamt, welche Unterlagen)
- Sozialverbände zur kostenlosen Beratung (VdK, SoVD)
- Bei Berufsbezug: Hinweis auf BK-3101-Meldeweg über die zuständige Berufsgenossenschaft
- Bewusst **keine** Anwaltsempfehlung im Sinne konkreter Kanzleien — Verweis auf die Anwaltssuche der Sozialverbände/Rechtsanwaltskammer

## 2a. 15-Minuten-Budget (Brainfog-Grenze) — zentrale Design-Nebenbedingung

Wichtiger Punkt: Bei Brain Fog ist nicht nur die *Anzahl* der Fragen das Problem, sondern **Tippen selbst ist anstrengend** und kann bei schwer Betroffenen sogar PEM triggern. Das Interview muss also nicht nur kurz, sondern auch tipparm sein.

**Turn-Budget statt Stoppuhr**: Ein Chat hat keine Uhr, die die KI "sieht" — das Limit wird über ein **Frage-Budget** durchgesetzt (Faustregel: ca. 6–8 Austausche inkl. Zusammenfassung, das entspricht bei realistischem Tippfluss ungefähr 15 Minuten). Die KI führt intern eine Zählung und steuert aktiv auf den Abschluss zu, statt Fragen zu sammeln, bis alles vollständig ist.

**Priorisierung der Fragen in zwei Stufen:**
- *Muss-Kriterien* (werden immer erfragt, auch wenn dafür andere Punkte wegfallen): PEM vorhanden? Dauer ≥ 6 Monate? Grobe Alltagsbeeinträchtigung (Bell-Score-Proxy: "Was schaffen Sie an einem normalen Tag noch, was nicht mehr?")
- *Kann-Kriterien* (nur wenn Budget reicht oder von der Person selbst schon erwähnt): Detaillierte Schlaf-/Schmerz-/autonome Symptomatik, Berufskontext, familiäre Auswirkungen im Detail

**Tipparme Frageform:**
- Geschlossene oder kurz zu beantwortende Fragen bevorzugen (Ja/Nein, Skala 1–10, Stichworte) statt offener Erzähl-Aufforderungen — außer bei der allerersten Einstiegsfrage.
- Ausdrücklich im Gespräch signalisieren: "Stichworte reichen völlig, Sie müssen keine ganzen Sätze schreiben."
- Mehrere zusammengehörige Unterfragen in einer Nachricht bündeln, statt Frage-für-Frage-Ping-Pong.

**Fortschrittsanzeige**: Jede Frage nennt kurz, wo im Prozess man steht (z. B. "Noch etwa 2–3 kurze Fragen, dann die Auswertung.") — gibt der Person Kontrolle darüber, ob sie durchhält oder abbricht.

**Jederzeitiger Vorzeitig-Abschluss**: Die Person kann jederzeit "Auswertung jetzt" sagen. Die KI erstellt dann die Einschätzung mit dem, was vorliegt, und markiert im Output explizit, welche Dimensionen nicht erhoben werden konnten (statt das zu verschweigen oder zu erzwingen).

**Spannungspunkt mit "keine Speicherung"**: Da nichts serverseitig gespeichert wird, überlebt eine Pause nur, solange der Browser-Tab offen bleibt (Client hält die Historie). Das muss der Person **vorab** transparent gemacht werden ("Planen Sie die gut 15 Minuten möglichst am Stück ein — schließen Sie den Tab, sind die Angaben weg"). Eine spätere Ausbaustufe könnte einen optionalen, Ende-zu-Ende-verschlüsselten "Auswertung als Text exportieren"-Button anbieten, damit die Person zwischenspeichern kann, ohne dass der Server etwas sieht.

## 3. Output-Template der Auswertung

```
📋 KI-GESTÜTZTE VORBEGUTACHTUNG — nicht medizinisch/juristisch verifiziert

Zusammenfassung Ihrer Angaben:
[3-5 Sätze, was verstanden wurde]

Eingeordnet nach: [CCC erfüllt: ja/teilweise/unklar] · [Dauer ≥6 Monate: ja/nein/unklar]

── Einschätzung ──
Grad der Behinderung (GdB), geschätzte Spanne: XX–XX
Begründung:
  • [Kriterium 1, z. B. PEM/Fatigue] → Bezug: VersMedV 18.4 i.V.m. 3.7,
    Einordnung als "[Stufe]" (Textstelle: "...")
  • [Kriterium 2, z. B. soziale Anpassungsschwierigkeiten] → ...
  • [ggf. Kriterium 3: pulmonale/kardiale Beteiligung] → Kapitel 8/9, ...

[Falls Berufsbezug genannt:]
Möglicher MdE-Bezug (gesetzliche Unfallversicherung): [Kurzhinweis + BK-3101 + Verweis
auf gesonderte MdE-Logik, keine Zahl ohne klaren Berufsunfall-/BK-Bezug]

── Wichtiger Hinweis ──
Dies ist eine KI-erstellte Einschätzung, die ausschließlich auf Ihren eigenen,
nicht überprüften Angaben beruht. Sie ersetzt keine ärztliche Untersuchung und
keine Rechtsberatung, erhebt keinen Anspruch auf Vollständigkeit oder Richtigkeit
und ist keine Entscheidung eines Versorgungsamts oder Gerichts. Für eine
verbindliche Einschätzung: Facharzt/Fachärztin bzw. Beratung bei einem
Sozialverband oder Fachanwalt/-anwältin für Sozialrecht.

Möchten Sie Informationen zur Antragstellung oder passende Anlaufstellen?
```

Der Disclaimer erscheint **zweimal**: kurz zu Beginn (Phase 1) und ausführlich am Ende jeder Auswertung (Phase 4) — deiner Vorgabe "nochmals darauf hinweisen" folgend.

## 4. System-Prompt (Entwurf für die Core-API)

```
Du bist ein Informationsassistent zur Vorbegutachtung bei Post-COVID/ME-CFS im
deutschen Sozialrecht (GdB nach VersMedV, ggf. MdE nach SGB VII bei Berufsbezug).

ZEITBUDGET (wegen Brain Fog zwingend einzuhalten):
- Das gesamte Interview soll in ca. 6-8 Austauschen abschließbar sein (~15 Minuten
  Tippaufwand). Führe intern Buch, wie viele Fragen du schon gestellt hast.
- Frage zuerst und bevorzugt: PEM vorhanden? Beschwerdedauer ≥ 6 Monate? Grobe
  Alltagsbeeinträchtigung. Alles andere nur, wenn das Budget es zulässt.
- Bevorzuge Ja/Nein-, Skala- oder Stichwort-Fragen. Sag der Person ausdrücklich,
  dass Stichworte reichen. Bündle zusammengehörige Unterfragen in einer Nachricht.
- Nenne bei jeder Frage kurz den Fortschritt (z. B. "noch ca. 2 kurze Fragen").
- Biete jederzeit an, sofort zur Auswertung überzugehen, wenn die Person das
  wünscht oder ermattet wirkt — markiere dann im Output, welche Punkte offen blieben.

GRUNDREGELN (nicht verhandelbar):
- ALLERERSTER Schritt, vor jeder inhaltlichen Frage: sag klar, dass der Chat nicht
  gespeichert wird und mit Schließen des Fensters alle Angaben weg sind.
- ZWEITER Schritt, als erste inhaltliche Frage: frage, ob Post-COVID/ME-CFS bereits
  ärztlich diagnostiziert/gesichert ist. Ist das nicht der Fall, sag zwingend, dass
  dies keine medizinische Beratung ist, keine Diagnose ersetzt, und dass eine
  ärztliche Untersuchung erforderlich ist — BEVOR du fortfährst. Lass die Person
  danach wählen, ob sie trotzdem eine rein orientierende Einschätzung möchte;
  markiere eine solche Einschätzung im Output deutlich als "Diagnose nicht gesichert".
- Du stellst keine Diagnosen. Du bewertest nur, was die Person selbst berichtet.
- Du gibst keine verbindliche Rechts- oder medizinische Auskunft. Jede Auswertung
  ist eine unverbindliche, KI-erstellte Einschätzung auf Basis der Eingaben.
- Du zitierst für jede Einschätzung eine konkrete Textstelle aus der Wissensbasis
  (VersMedV-Abschnitt, CCC-Kriterium, Urteil) — keine Bewertung ohne Beleg.
- Du nennst zu Beginn UND am Ende jeder Auswertung den vollständigen Disclaimer
  (siehe Output-Template).
- Bei Hinweisen auf Suizidalität, akute Verzweiflung oder Krise: brich die
  Begutachtungslogik ab, reagiere unterstützend und nenne Kriseninformationen,
  bevor du zu Begutachtungsthemen zurückkehrst.
- Du speicherst nichts über diese Konversation hinaus. Weise die Person darauf hin,
  falls sie danach fragt.
- Du bist kein Ersatz für einen Fachanwalt/eine Fachanwältin für Sozialrecht oder
  einen Facharzt/eine Fachärztin — verweise bei Bedarf aktiv dorthin.

TONALITÄT: unterstützend, nicht bürokratisch-kalt, aber auch nicht false-hope-
erzeugend. Die Zielgruppe ist oft schwer erschöpft (Brain Fog) — kurze Absätze,
keine Bandwurmsätze, eine Frage nach der anderen in Phase 2.

WISSENSBASIS: [RAG-Kontext wird hier eingefügt — Auszüge aus VersMedV Kap. 3/8/9/18,
CCC-Kriterien, aktuelle Urteile]
```

## 5. Offene technische Entscheidungen für die nächste Ausbaustufe
- Guided-Interview-Logik: reines Prompt-Engineering (LLM führt das Gespräch selbst) vs. strukturierter Zustandsautomat, der Pflichtfelder abhakt, bevor die KI zur Auswertung übergeht — Empfehlung: für MVP reines Prompt-Engineering, da flexibler bei individuellen Schilderungen; ein State-Tracking (welche CCC-Kategorien schon abgedeckt sind) kann serverseitig mitlaufen, ohne die Antworten selbst zu speichern.
- Sprachmodell für die Auswertung: sollte dasselbe RAG-gestützte Backend sein, unabhängig davon, über welches Frontend (Claude/ChatGPT/Gemini) der Zugang erfolgt — sonst weichen Einschätzungen je nach genutztem Anbieter ab.

## Nächster Schritt
Vorschlag: einen funktionsfähigen Prototyp des Interviews + Auswertung bauen (z. B. als HTML-Chat-Demo mit der RAG-Logik gegen die vier bestehenden Referenzdateien), um das Interaktionsdesign konkret zu testen, bevor die Multi-Frontend-Infrastruktur (MCP/GPT Action/Gemini) aufgesetzt wird.
