import type { Answers, Question } from "./types";
import { BELL_SCORE_DE } from "../bellScore";

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
    id: "pemTriggerart",
    showIf: (a) => a.pem === "ja",
    prompt: "Wodurch wird die Verschlechterung bei Ihnen ausgelöst? (Mehrfachauswahl möglich)",
    type: "multi",
    options: [
      { value: "koerperlich", label: "Körperliche Anstrengung" },
      { value: "geistig", label: "Geistige Anstrengung (z. B. Konzentration, Bildschirmarbeit)" },
      { value: "emotional", label: "Emotionale Belastung (z. B. Aufregung, Stress)" },
      { value: "unklar", label: "Lässt sich nicht klar unterscheiden" },
    ],
    exclusiveValue: "unklar",
  },
  {
    id: "pemAusloeseschwelle",
    showIf: (a) => a.pem === "ja",
    prompt: "Wie stark muss die Belastung sein, damit bei Ihnen eine PEM-Verschlechterung auftritt?",
    type: "single",
    options: [
      { value: "leichteste-alltagsbelastung", label: "Schon kleinste Anstrengung reicht (z. B. wenige Schritte gehen, ein kurzes Gespräch, sich kurz konzentrieren)" },
      { value: "mittelschwere-belastung", label: "Erst bei mittlerer Anstrengung (z. B. kurzer Spaziergang, längeres Gespräch, eine Stunde Bildschirmarbeit)" },
      { value: "nur-starke-belastung", label: "Erst bei stärkerer, länger andauernder Anstrengung" },
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
    id: "schmerzausbreitung",
    showIf: hatRelevanteSchmerzangabe,
    prompt: "Sind Ihre Schmerzen eher auf einzelne Körperbereiche begrenzt oder über mehrere Körperregionen verteilt spürbar?",
    type: "single",
    options: [
      { value: "begrenzt", label: "Auf einzelne Bereiche begrenzt" },
      { value: "mehrere-regionen", label: "Über mehrere Körperregionen verteilt" },
      { value: "generalisiert", label: "Nahezu am ganzen Körper spürbar" },
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
      { value: "koordination", label: "Gang-/Koordinationsstörung oder spürbare Muskelschwäche" },
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
    id: "paraesthesien",
    prompt:
      "Haben Sie Gefühlsstörungen wie Kribbeln, Taubheit, Brennen oder Ameisenlaufen (Parästhesien), z. B. in Armen, Beinen, Händen oder Füßen?",
    type: "single",
    options: [
      { value: "keine", label: "Keine" },
      { value: "leicht", label: "Leicht bis gelegentlich spürbar" },
      { value: "deutlich", label: "Deutlich, regelmäßig bis dauerhaft spürbar" },
      { value: "deutlich-mit-schwaeche", label: "Deutlich, zusätzlich mit spürbarer Muskelschwäche oder Gangunsicherheit" },
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
      "Der Bell-Score wird in 10er-Schritten vergeben (0, 10, 20, … 100) und beschreibt Ihr allgemeines Leistungsniveau bei ME/CFS/Fatigue — 100 = keine Einschränkung, 0 = schwerste Einschränkung. Die deutsche Tabelle unten hilft bei der Einordnung; wählen Sie den Wert, der am ehesten passt, oder überspringen Sie die Frage.",
    // Feste 10er-Schritte statt Freitext-Zahl (Bugfix: ein Freitextfeld
    // erlaubte zuvor z. B. "45", das der Bell-Score als Instrument gar nicht
    // kennt - er ist ausschließlich in diesen elf Stufen definiert, siehe
    // lib/bellScore.ts).
    type: "single",
    options: BELL_SCORE_DE.map((row) => ({ value: String(row.score), label: String(row.score) })),
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
    hint: "Ein bereits bei den autonomen Beschwerden genannter Schellong-/Kipptisch-Test zählt hier ebenfalls.",
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
