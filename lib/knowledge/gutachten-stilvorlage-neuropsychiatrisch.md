# Stilvorlage: Formaler Aufbau eines neurologisch-psychiatrischen Kurzgutachtens

Diese Datei ist **keine** Rechts- oder GdB/MdE-Kalibrierungsquelle, sondern eine reine
**Format-/Struktur-Referenz**. Sie fasst zusammen, wie ein fachärztliches Kurzgutachten aus
Neurologie/Psychiatrie im deutschen Sprachraum typischerweise gegliedert und formuliert ist,
abgeleitet aus einem frei zugänglichen, ausdrücklich als **fiktiv** gekennzeichneten
Musterdokument eines Rechtsanwaltsportals (medicolexoffice.de, "Beispiel neurologisches
Kurzgutachten"). Die Struktur ist generisch für die Textsorte "fachärztliches Gutachten" und
kein urheberrechtlich geschützter Spezialinhalt; der konkrete Wortlaut des Musterdokuments wird
hier bewusst **nicht** übernommen, sondern nur das Gliederungs- und Formulierungsmuster
abstrahiert.

## Wofür diese Datei gedacht ist — und wofür nicht

- **Gedacht für**: das Wiedererkennen und Einordnen von Gutachten-Textbausteinen, wenn Nutzer:innen
  (z. B. im BASTET · Doc-Arm) ein bereits vorliegendes fachärztliches Gutachten einfügen oder
  danach fragen, wie ein Abschnitt einzuordnen ist ("Was bedeutet der Teil 'Psychopathologie'
  in meinem Gutachten?"); als Referenz, wenn eine Freitext-Anamnese in gutachtenübliche
  Kategorien vorsortiert werden soll, bevor die eigentliche GdB/MdE-Einschätzung erfolgt.
- **Nicht gedacht für**: BASTET soll **kein** Dokument erzeugen, das im Layout/Briefkopf wie ein
  eigenständiges, von einer Fachärztin/einem Facharzt unterzeichnetes amtliches Gutachten
  aussieht (fiktiver Absender, Praxisadresse, Unterschriftszeile o. Ä.). Das wäre eine
  irreführende Anmaßung fachärztlicher Autorität und steht im Widerspruch zur in
  `strategie/begutachtungs-agent-architektur.md` Abschnitt 5 festgelegten Beschränkung auf
  allgemeine Information (RDG-Grenze). Das bestehende AUSWERTUNGS-FORMAT in `lib/doc.ts`
  ("📋 Fachliche Orientierung — keine förmliche Begutachtung") bleibt die einzig zulässige
  BASTET-eigene Ausgabeform; diese Datei liefert höchstens Vokabular/Gliederungslogik für dessen
  Binnenstruktur, niemals eine Vorlage für ein Gutachten-Faksimile.

## Typischer Aufbau (Gliederungsskelett)

**Kopfteil** (vor der eigentlichen Gliederung):
- Gutachter:in mit Fachrichtung und Anschrift
- Patient:in — im Original meist anonymisiert/pseudonymisiert (Kürzel statt Klarname,
  Versicherungsnummer "anonymisiert")
- Behandlungs- bzw. Begutachtungszeitraum
- Datum der Gutachtenanforderung

**1. Anamnese** — nach Fachrichtung in Unterpunkte gegliedert, typischerweise:
- 1.1 Fachspezifische Anamnese (z. B. neurologisch): Leitsymptom, Verlauf/Dauer, Auslöser/
  Verstärker, bereits ausgeschlossene Differenzialdiagnosen, relevante Vorgeschichte
- 1.2 Zweite Fachanamnese (z. B. psychiatrisch): subjektives Belastungserleben, beruflicher/
  sozialer Kontext, Vorerkrankungen
- 1.3 Familienanamnese — meist als kurze Stichpunktliste je Angehörigem (Erkrankung, nicht
  Diagnosedetail)
- 1.4 Medikamentenanamnese — aktuelle und zurückliegende Medikation, auch freiverkäufliche

**2. Körperlich-technische Untersuchung** (z. B. "Neurologische Untersuchung") — durchgehend in
kurze, befundorientierte Unterpunkte gegliedert, je mit konkretem Messwert/Skala statt vager
Beschreibung, u. a.:
- Allgemeinzustand
- Motorik (Kraftgrad-Skala, Koordinationstests)
- Sensibilität
- Reflexe (inkl. explizitem Ausschluss pathologischer Reflexe)
- Kognitive Testung (benannter Testname + erzielte Punktzahl, z. B. Screening-Score von X/30)
- Apparative/bildgebende Zusatzdiagnostik mit Ergebnis in einem Satz

**3. Zweite fachspezifische Untersuchung** (z. B. "Psychiatrische Untersuchung") — ebenfalls in
kurze Unterpunkte gegliedert:
- Allgemeiner Eindruck
- Antrieb
- Kognitive Funktionen (mit konkretem Testverfahren, z. B. Trail-Making-Test)
- Psychopathologischer Befund — hier wird die zugehörige ICD-10-Diagnose meist direkt im
  Fließtext in Klammern genannt, nicht erst im Diagnosenteil
- Schlafverhalten
- Affektivität — inkl. expliziter Aussage zu Suizidalität (auch wenn verneint)

**4. Diagnosen** — knappe Liste, jeweils "ICD-10-Code – Diagnosebezeichnung", bei sekundären/
abgeleiteten Diagnosen mit kurzer Kausalitätsangabe in Klammern.

**5. Einschätzung der (Arbeits-)Fähigkeit** — klare Ja/Nein-Aussage zur aktuellen
Arbeitsfähigkeit, plus Prognosehorizont für eine mögliche stufenweise Wiedereingliederung
(konkreter Zeitraum, an Behandlungsverlauf geknüpft).

**6. Empfehlungen** — wieder in Unterpunkte gegliedert, typischerweise:
- 6.1 Psycho-/Fachtherapeutische Behandlung
- 6.2 Medikamentöse Therapie (Wirkstoffgruppen, nicht zwingend Präparatnamen)
- 6.3 Weitere Verlaufskontrollen/Untersuchungen

**7. Prognose** — abschließende Gesamteinschätzung mit Zeithorizont, meist optimistischer
formuliert als die vorangehenden Befundabschnitte.

## Stilistische Muster

- Durchgehender Fließtext pro Unterpunkt, keine Stichpunktlisten außer bei Familienanamnese und
  Diagnosen.
- Passiv- und Befund-Sprache ("wurde durchgeführt", "zeigte sich", "es bestanden keine
  Auffälligkeiten hinsichtlich …") statt subjektiver Formulierungen.
- Negativbefunde werden aktiv benannt, nicht weggelassen ("keine pathologischen Reflexe wie
  Babinski oder Clonus", "keine Suizidalität") — dient der gutachterlichen Vollständigkeit.
- Konkrete Zahlenwerte/Skalenangaben wo immer möglich (Testscores, Kraftgrade), statt reiner
  Adjektive.
- ICD-10-Code steht bei Erstnennung im Fließtext in Klammern hinter der Diagnosebezeichnung und
  wird im Diagnosenteil identisch wiederholt.
- Empfehlungsteil trennt klar zwischen Therapieformen (psycho-/pharmakotherapeutisch) und
  Verlaufsdiagnostik.

## Bezug zu bestehenden BASTET-Dateien

- Ergänzt `nervensystem-psyche-herz-gdb.md` (dort die inhaltliche GdB-Tabelle zu Depression/
  Angst/PTBS) und `neurologie-vergleichsfaelle.md`/`schlaf-schwindel-kognitiv-faelle.md` (dort
  die MdE/GdB-Kalibrierung zu Kopfschmerz, Schwindel, kognitiven Störungen) um die reine
  Formfrage — diese Datei sagt, **wie** ein Befund gutachtenüblich strukturiert wird, nicht
  **welcher GdB/MdE-Wert** angemessen ist.
- Für den in `ccc-fragenkatalog-kalibrierung.md` beschriebenen strukturierten Fragenkatalog
  nutzbar, um die Interview-Ausgabe intern (nicht im Nutzer-Chat) in gutachtenübliche
  Kategorien (Anamnese/Befund/Diagnose/Einschätzung) vorzusortieren.

## Alternative: formularbasierte amtliche Gutachten (Ankreuzformular statt Fließtext)

Der oben beschriebene Fließtext-Stil ist nicht die einzige Gutachten-Form. Amtliche Stellen
verlangen häufig strukturierte, teils ausfüllbare PDF-Formulare mit Ankreuzfeldern statt freier
Prosa. Zwei reale (nicht fiktive) amtliche Formulare zur Einordnung:

- **DRV Westfalen, Formular 6-810/6-811-2** — "Ärztliches Gutachten für die Westfälische
  Arbeitsgemeinschaft für Rehabilitation einschließlich Honorarabrechnung", Stand 01.09.2014,
  ausfüllbares PDF. Kombiniert das eigentliche Reha-Gutachten mit der Honorarabrechnung des
  begutachtenden Arztes in einem Formular — Beispiel dafür, dass ein Rentenversicherungsträger
  Begutachtung und Vergütung administrativ in einem Dokument bündelt. Inhaltlich zu
  medizinischer Rehabilitation (SGB IX/VI), nicht zu GdB/MdE.
- **Zentraler Thüringer Formularpool, BTBG-014-DE-FL** — "Ärztliches Gutachten" zur Vorlage
  beim Betreuungsgericht (Anordnung/Verlängerung einer Betreuung, geschlossene Unterbringung,
  freiheitsentziehende Maßnahmen). Rein formularbasiert: Ankreuzfelder für Diagnosegruppen
  (hirnorganisches Psychosyndrom, schizophrene Psychose, senile Demenz, Suchtkrankheit),
  Ankreuzfelder für den vorgeschlagenen Aufgabenkreis der Betreuung, kurze Freitextfelder nur für
  Begründung/Eilbedürftigkeit, Unterschrift und Praxisstempel am Ende.
  **Wichtige Einordnung**: Dieses Formular gehört zum **Betreuungsrecht** (§§ 1814 ff. BGB), einem
  komplett anderen Rechtsgebiet als GdB/GdS/MdE — es hat mit Post-COVID/ME-CFS-Begutachtung
  inhaltlich nichts zu tun und liegt außerhalb des bisherigen BASTET-Fokus. Es dient hier rein als
  **Strukturbeispiel** für eine dritte Gutachten-Form (amtliches Ankreuzformular für eine
  Gefährdungs-/Unterbringungsfrage) und wird nicht in die GdB/MdE-Logik eingebaut.

**Strukturelle Lehre für BASTET**: Nutzer:innen könnten künftig statt eines Fließtext-Gutachtens
ein ausgefülltes amtliches Formular einfügen. Erkennungsmerkmale: Ankreuzfelder/Kästchen statt
Absätzen, knappe Stichwort-Diagnosen ohne ausformulierten Befund, Ja/Nein-Entscheidungsfragen
statt Prosa-Einschätzung, Unterschrift/Stempel-Zeile am Ende statt Prognose-Absatz. Beim
Einordnen eines solchen Dokuments sollte BASTET diesen Formularcharakter erkennen und nicht
versuchen, fehlende Fließtext-Abschnitte (z. B. "Psychopathologie", "Prognose") hineinzulesen, die
das Formular schlicht nicht vorsieht.

## Quelle
- medicolexoffice.de, "Beispiel neurologisches Kurzgutachten" — ausdrücklich als **fiktives
  Musterdokument** gekennzeichnet (frei zugängliches Kanzlei-Informationsmaterial, kein reales
  Patientengutachten, keine reale Ärztin). Stand der Abfrage 09/2026.
- Deutsche Rentenversicherung Westfalen, Formular 6-810/6-811-2, deutsche-rentenversicherung.de
  (amtliches, öffentlich abrufbares Formular). Stand der Abfrage 09/2026.
- Zentraler Thüringer Formularpool, Formular BTBG-014-DE-FL, thformular.thueringen.de (amtliches,
  öffentlich abrufbares Formular). Stand der Abfrage 09/2026.
