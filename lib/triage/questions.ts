import type { Answers, Question } from "./types";

// Jede Frage entspricht 1:1 einem Abfragepunkt aus
// lib/knowledge/ccc-fragenkatalog-kalibrierung.md - die Ausprägungen dort sind
// hier direkt die Button-Optionen. Reihenfolge bewusst so gewählt, dass die
// beiden CCC-Pflichtkriterien (PEM, Dauer) zuerst kommen: wer die schon nicht
// erfüllt, bekommt trotzdem eine vollständige, aber entsprechend eingeordnete
// Kurzauswertung, ohne erst durch alle Detailfragen zu müssen.

export const QUESTIONS: Question[] = [
  {
    id: "pem",
    prompt:
      "Tritt bei Ihnen nach körperlicher, geistiger oder emotionaler Belastung eine verzögerte Verschlechterung ein (Post-exertionelle Malaise, PEM)?",
    type: "single",
    options: [
      { value: "ja", label: "Ja" },
      { value: "nein", label: "Nein" },
      { value: "unklar", label: "Unklar / noch nie darauf geachtet" },
    ],
  },
  {
    id: "pemLatenz",
    showIf: (a) => a.pem === "ja",
    prompt: "Wie schnell tritt die Verschlechterung nach der Belastung typischerweise ein?",
    type: "single",
    options: [
      { value: "sofort", label: "Sofort, noch während der Belastung" },
      { value: "stunden", label: "Nach einigen Stunden" },
      { value: "1-3-tage", label: "Verzögert, nach 1–3 Tagen (typisch für ME/CFS)" },
    ],
  },
  {
    id: "pemErholung",
    showIf: (a) => a.pem === "ja",
    prompt: "Wie lange dauert es meist, bis Sie sich davon wieder erholt haben?",
    type: "single",
    options: [
      { value: "stunden", label: "Stunden" },
      { value: "tage", label: "Tage" },
      { value: "ueber-woche", label: "Über eine Woche" },
      { value: "ueber-monat", label: "Über einen Monat" },
    ],
  },
  {
    id: "dauer",
    prompt: "Bestehen Ihre Beeinträchtigungen schon länger als 6 Monate durchgehend?",
    type: "single",
    options: [
      { value: "ja", label: "Ja, länger als 6 Monate" },
      { value: "nein", label: "Nein, noch keine 6 Monate" },
    ],
  },
  {
    id: "schmerz",
    prompt:
      "Welche der folgenden Schmerzformen haben Sie? (Mehrfachauswahl möglich — für die CCC-Kriterien zählen mindestens 2)",
    type: "multi",
    options: [
      { value: "muskel", label: "Muskelschmerzen" },
      { value: "gelenk", label: "Gelenkschmerzen (ohne Schwellung/Rötung)" },
      { value: "kopf-neu", label: "Kopfschmerzen neuen Typs/Musters" },
      { value: "hals", label: "Halsschmerzen" },
      { value: "lymphknoten", label: "Druckschmerzhafte Lymphknoten" },
      { value: "keine", label: "Keine davon" },
    ],
  },
  {
    id: "kognitiv",
    prompt:
      "Welche kognitiven/neurologischen Beeinträchtigungen haben Sie? (Mehrfachauswahl — für die CCC-Kriterien zählen mindestens 2)",
    type: "multi",
    options: [
      { value: "konzentration", label: "Konzentrationsstörungen" },
      { value: "gedaechtnis", label: "Kurzzeitgedächtnisstörungen" },
      { value: "wortfindung", label: "Wortfindungsstörungen" },
      { value: "verarbeitung", label: "Verlangsamte Informationsverarbeitung" },
      { value: "reizueberempfindlich", label: "Reizüberempfindlichkeit (Licht/Geräusche)" },
      { value: "koordination", label: "Gang-/Koordinationsstörung" },
      { value: "keine", label: "Keine davon" },
    ],
  },
  {
    id: "autonom",
    prompt:
      "Haben Sie eines der folgenden autonomen/körperlichen Anzeichen? (Mehrfachauswahl)",
    type: "multi",
    options: [
      { value: "orthostatisch", label: "Schwindel/Herzrasen im Stehen" },
      { value: "temperatur", label: "Gestörte Temperaturregulation (Kälte-/Wärmeintoleranz)" },
      { value: "gi", label: "Reizdarm-artige Beschwerden" },
      { value: "infekt", label: "Erhöhte Infektanfälligkeit / neue Unverträglichkeiten" },
      { value: "keine", label: "Keine davon" },
    ],
  },
  {
    id: "autonomHfDokumentiert",
    showIf: (a) => Array.isArray(a.autonom) && a.autonom.includes("orthostatisch"),
    prompt:
      "Wurde ein Herzfrequenzanstieg beim Aufstehen (z. B. Schellong-Test, Kipptisch) je gemessen?",
    type: "single",
    options: [
      { value: "ja", label: "Ja, ≥30 bpm bzw. auf ≥120 bpm dokumentiert" },
      { value: "nein-getestet", label: "Getestet, aber unauffällig" },
      { value: "nicht-getestet", label: "Nie getestet" },
    ],
  },
  {
    id: "schlaf",
    prompt: "Wie würden Sie Ihren Schlaf beschreiben?",
    type: "single",
    options: [
      { value: "nicht-erholsam", label: "Nicht erholsam, trotz ausreichender Dauer" },
      { value: "ein-durchschlaf", label: "Ein-/Durchschlafstörung" },
      { value: "rhythmus", label: "Gestörter Tag-Nacht-Rhythmus" },
      { value: "unauffaellig", label: "Weitgehend unauffällig" },
    ],
  },
  {
    id: "psychKomorbid",
    prompt:
      "Besteht zusätzlich eine eigenständige psychiatrische Diagnose (nicht nur eine Belastungsreaktion auf die körperliche Erkrankung)?",
    type: "single",
    options: [
      { value: "ja-gesichert", label: "Ja, fachärztlich gesichert" },
      { value: "ja-ungesichert", label: "Vermutet, aber nicht fachärztlich gesichert" },
      { value: "nein", label: "Nein, nur reaktive Belastung" },
    ],
  },
  {
    id: "arbeitsfaehigkeit",
    prompt:
      "Grob geschätzt: Wie viele Stunden täglich wäre irgendeine leichte Tätigkeit auf dem allgemeinen Arbeitsmarkt für Sie aktuell vorstellbar — unabhängig von Ihrem bisherigen Beruf?",
    hint: "Diese Frage wird für die Einordnung zur Erwerbsminderungsrente (SGB VI) gebraucht, nicht für den GdB.",
    type: "single",
    options: [
      { value: "ueber-6", label: "6 Stunden oder mehr" },
      { value: "3-bis-6", label: "3 bis unter 6 Stunden" },
      { value: "unter-3", label: "Unter 3 Stunden" },
      { value: "unklar", label: "Kann ich nicht einschätzen" },
    ],
  },
  {
    id: "beruflicherKontext",
    prompt:
      "Bestand ein beruflicher Zusammenhang mit Ihrer Erkrankung (z. B. Tätigkeit im Gesundheitsdienst, in der Wohlfahrtspflege oder in einem Labor, dort infiziert)?",
    type: "single",
    options: [
      { value: "ja", label: "Ja" },
      { value: "nein", label: "Nein" },
    ],
  },
  {
    id: "bk3101Status",
    showIf: (a) => a.beruflicherKontext === "ja",
    prompt: "Wie ist der Status einer Berufskrankheiten-Meldung (BK-Nr. 3101)?",
    type: "single",
    options: [
      { value: "nicht-gemeldet", label: "Noch nicht gemeldet" },
      { value: "gemeldet-offen", label: "Gemeldet, Verfahren läuft noch" },
      { value: "anerkannt", label: "Bereits anerkannt" },
    ],
  },
];

/** Liefert die nächste noch offene Frage, oder null wenn fertig. */
export function nextQuestion(answers: Answers): Question | null {
  for (const q of QUESTIONS) {
    if (q.showIf && !q.showIf(answers)) continue;
    if (answers[q.id] === undefined) return q;
  }
  return null;
}

/** Für die Fortschrittsanzeige: wie viele der aktuell relevanten Fragen sind schon beantwortet. */
export function progress(answers: Answers): { done: number; total: number } {
  const relevant = QUESTIONS.filter((q) => !q.showIf || q.showIf(answers));
  const done = relevant.filter((q) => answers[q.id] !== undefined).length;
  return { done, total: relevant.length };
}
