import type { Answers, Question } from "./types";

/** Für showIf("schmerzschwere") - dieselbe "mindestens ein relevanter Wert
 *  außer dem Ausschlusswert"-Logik wie countRelevant() in scoring.ts, hier
 *  aber nur als boolescher Check, ohne scoring.ts zu importieren (Tier-1-
 *  Module bleiben bewusst unabhängig voneinander, siehe dortiger Kommentar). */
function hatRelevanteSchmerzangabe(a: Answers): boolean {
  const v = a.schmerz;
  const arr = Array.isArray(v) ? v : v ? [v] : [];
  return arr.some((s) => s !== "keine");
}

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
    id: "pemAusloeseschwelle",
    showIf: (a) => a.pem === "ja",
    prompt: "Wie stark muss die Belastung sein, damit bei Ihnen eine PEM-Verschlechterung auftritt?",
    type: "single",
    options: [
      { value: "leichteste-alltagsbelastung", label: "Schon leichteste Alltagsbelastung reicht (z. B. Zähneputzen, kurzes Gespräch)" },
      { value: "mittelschwere-belastung", label: "Erst bei mittelschwerer Belastung (z. B. kurzer Spaziergang, Hausarbeit)" },
      { value: "nur-starke-belastung", label: "Nur bei stärkerer Belastung (z. B. längere körperliche Anstrengung)" },
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
      "Welche der folgenden Schmerzformen haben Sie? (Mehrfachnennung möglich)",
    type: "multi",
    options: [
      { value: "muskel", label: "Muskelschmerzen" },
      { value: "gelenk", label: "Gelenkschmerzen (ohne Schwellung/Rötung)" },
      { value: "kopf-neu", label: "Neuartige Kopfschmerzen" },
      { value: "hals", label: "Halsschmerzen" },
      { value: "lymphknoten", label: "Druckschmerzhafte Lymphknoten" },
      { value: "keine", label: "Keine davon" },
    ],
  },
  {
    id: "schmerzschwere",
    showIf: hatRelevanteSchmerzangabe,
    prompt: "Wie stark beeinträchtigen Sie diese Schmerzen insgesamt im Alltag?",
    type: "single",
    options: [
      { value: "kaum", label: "Kaum spürbar" },
      { value: "spuerbar", label: "Spürbar, aber alltagstauglich" },
      { value: "deutlich", label: "Deutlich einschränkend" },
      { value: "kaum-auszuhalten", label: "Sehr stark, kaum auszuhalten" },
    ],
  },
  {
    id: "kognitiv",
    prompt:
      "Welche kognitiven/neurologischen Beeinträchtigungen haben Sie? (Mehrfachnennung möglich)",
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
    prompt: "Welche der folgenden autonomen/körperlichen Anzeichen haben Sie? (Mehrfachauswahl)",
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
    prompt: "Wurde jemals ein Herzfrequenzanstieg beim Aufstehen (z. B. Schellong-Test, Kipptisch) gemessen?",
    type: "single",
    options: [
      { value: "ja", label: "Ja, ≥30 bpm bzw. auf ≥120 bpm dokumentiert" },
      { value: "nein-getestet", label: "Getestet, aber unauffällig" },
      { value: "nicht-getestet", label: "Nie getestet" },
    ],
  },
  {
    id: "schlaf",
    prompt: "Welche der folgenden Schlafprobleme haben Sie? (Mehrfachauswahl möglich)",
    type: "multi",
    exclusiveValue: "unauffaellig",
    options: [
      { value: "nicht-erholsam", label: "Nicht erholsam, trotz ausreichender Dauer" },
      { value: "ein-durchschlaf", label: "Ein-/Durchschlafstörung" },
      { value: "rhythmus", label: "Gestörter Tag-Nacht-Rhythmus" },
      { value: "unauffaellig", label: "Weitgehend unauffällig" },
    ],
  },
  {
    id: "atembeschwerden",
    prompt:
      "Haben Sie durch Atembeschwerden bedingte Einschränkungen (z. B. Atemnot bei Belastung, ärztlich festgestellte Lungenfunktionseinschränkung)?",
    type: "single",
    options: [
      { value: "keine", label: "Keine" },
      { value: "mittelschwere-belastung", label: "Atemnot bei mittelschwerer Belastung (z. B. forsches Gehen, Treppensteigen)" },
      { value: "leichte-belastung", label: "Atemnot bereits bei leichter Alltagsbelastung" },
      { value: "ruhe", label: "Atemnot bereits in Ruhe oder bei leichtester Belastung" },
    ],
  },
  {
    id: "diabetesStatus",
    prompt: "Ist im Zusammenhang mit Ihrer Erkrankung neu ein Diabetes mellitus aufgetreten oder bei Ihnen bekannt?",
    type: "single",
    options: [
      { value: "nein", label: "Nein" },
      { value: "diaet", label: "Ja, mit Diät allein eingestellt" },
      { value: "orale-nicht-hypo", label: "Ja, mit Medikamenten ohne erhöhte Unterzuckerungsneigung" },
      { value: "orale-hypo", label: "Ja, mit Medikamenten mit erhöhter Unterzuckerungsneigung" },
      { value: "insulin-stabil", label: "Ja, mit Insulin, stabile bis mäßig schwankende Stoffwechsellage" },
      { value: "insulin-instabil", label: "Ja, mit Insulin, instabile Stoffwechsellage (inkl. gelegentlicher schwerer Unterzuckerungen)" },
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
    id: "bellScore",
    prompt: "Können Sie Ihren Bell-Score schätzen?",
    hint:
      "Der Bell-Score (0–100) beschreibt Ihr allgemeines Leistungsniveau bei ME/CFS/Fatigue — 100 = keine Einschränkung, 0 = schwerste Einschränkung. Falls Ihnen die Skala nicht geläufig ist, nutzen Sie die deutsche Tabelle unten oder überspringen Sie die Frage.",
    type: "number",
    options: [],
    placeholder: "z. B. 45",
    min: 0,
    max: 100,
    optional: true,
  },
  {
    id: "alltagsverrichtungen",
    prompt: "Wie kommen Sie aktuell im Alltag zurecht?",
    type: "single",
    options: [
      { value: "selbststaendig", label: "Selbstständig, ohne fremde Hilfe" },
      { value: "unterstuetzung", label: "Mit Unterstützung bei einzelnen Verrichtungen" },
      { value: "bettlaegerig-nah", label: "Weitgehend bettlägerig / auf Hilfe bei den meisten Verrichtungen angewiesen" },
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
    id: "objektiveTests",
    prompt:
      "Wurden bei Ihnen bereits objektive Tests durchgeführt (z. B. 6-Minuten-Gehstrecke, Handkraftmessung, neuropsychologische Testung)?",
    type: "single",
    options: [
      { value: "auffaellig", label: "Ja, mit auffälligem/pathologischem Ergebnis" },
      { value: "unauffaellig", label: "Ja, Ergebnis unauffällig" },
      { value: "nein", label: "Nein, noch keine durchgeführt" },
      { value: "unbekannt", label: "Weiß ich nicht" },
    ],
  },
  {
    id: "beruflicherKontext",
    prompt:
      "Ist Ihre Erkrankung durch die Berufsgenossenschaft/gesetzliche Unfallversicherung als Berufskrankheit (z. B. BK-Nr. 3101), Arbeits- oder Wegeunfall anerkannt?",
    hint:
      "Das betrifft nur die gesetzliche Unfallversicherung (z. B. bei Ansteckung während einer Tätigkeit im Gesundheitsdienst, in der Wohlfahrtspflege oder in einem Labor) — nicht die gesetzliche oder private Krankenversicherung.",
    type: "single",
    options: [
      { value: "anerkannt", label: "Ja, bereits anerkannt" },
      { value: "gemeldet-offen", label: "Gemeldet, Verfahren läuft noch" },
      { value: "nicht-gemeldet", label: "Noch nicht gemeldet, aber beruflicher Zusammenhang wahrscheinlich" },
      { value: "nein", label: "Nein, kein beruflicher Zusammenhang" },
      { value: "unsicher", label: "Unsicher / möglicher, aber unklarer Zusammenhang" },
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
