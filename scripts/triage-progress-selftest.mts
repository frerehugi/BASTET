// Regressionstest für die Fortschrittsanzeige (lib/triage/questions.ts,
// progress()) - separat von triage-scoring-selftest.mts, da es hier NICHT um
// die GdB/MdE-Berechnung geht, sondern nur um das "Noch X von Y Fragen"-UI
// (app/TriageFlow.tsx).
//
// Hintergrund: Die Anzeige zählte ursprünglich nur die aktuell relevanten
// Fragen (z.B. 16 zu Beginn) und ließ diese Zahl mitten im Ablauf nach OBEN
// springen, sobald ein bedingter Zweig (z.B. PEM = "Ja") weitere Fragen
// freischaltete (16 -> 20) - von Florian als für neurodivergente
// Nutzer:innen irritierend gemeldet. Jetzt fest auf die Gesamtzahl aller
// Fragen (24), die Anzeige zählt stattdessen rückwärts und darf dabei nur
// nach unten springen (weniger übrig), nie nach oben. Dieses Skript hält das
// dauerhaft fest.
//
// Ausführen: npx tsx scripts/triage-progress-selftest.mts (oder `npm run
// test:triage-progress`) - kein Server, kein ANTHROPIC_API_KEY nötig.

import { QUESTIONS, progress } from "../lib/triage/questions.ts";
import type { Answers } from "../lib/triage/types.ts";

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  const status = ok ? "OK  " : "FAIL";
  console.log(`[${status}] ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures += 1;
}

const TOTAL = QUESTIONS.length;

console.log("=== Gesamtzahl ist fest, unabhängig vom Antwortstand ===");
check("Leere Antworten: total = Gesamtzahl aller Fragen", progress({}).total === TOTAL, `${progress({}).total}`);
check(
  "Nach PEM = Ja beantwortet: total bleibt gleich (springt NICHT nach oben)",
  progress({ pem: "ja" }).total === TOTAL,
  `${progress({ pem: "ja" }).total}`
);

console.log("\n=== Remaining fällt bei normaler Beantwortung um genau 1 ===");
const vorPem = progress({});
const nachPemJa = progress({ pem: "ja" });
check(
  "PEM = Ja (nimmt den Zweig, keine Frage wird übersprungen): remaining fällt um 1",
  nachPemJa.remaining === vorPem.remaining - 1,
  `${vorPem.remaining} -> ${nachPemJa.remaining}`
);

console.log("\n=== Remaining springt beim Überspringen eines Zweigs nach UNTEN, nie nach oben ===");
const nachPemNein = progress({ pem: "nein" });
check(
  "PEM = Nein (überspringt 4 Folgefragen): remaining fällt um mehr als 1",
  nachPemNein.remaining < vorPem.remaining - 1,
  `${vorPem.remaining} -> ${nachPemNein.remaining}`
);
check(
  "PEM = Nein: remaining fällt nie unter 0 und springt nicht nach oben",
  nachPemNein.remaining < vorPem.remaining && nachPemNein.remaining >= 0
);

console.log("\n=== Vollständiger Durchlauf: remaining fällt monoton, endet bei 0 ===");
// Ein Pfad, der JEDEN bedingten Zweig nimmt (PEM=ja, Schmerz vorhanden,
// Autonom mit Orthostase, Medikation=ja), damit alle 25 Fragen durchlaufen
// werden - strengster Test für Monotonie.
const vollerPfad: Array<[keyof Answers, string | string[]]> = [
  ["pem", "ja"],
  ["pemTriggerart", ["koerperlich"]],
  ["pemAusloeseschwelle", "mittelschwere-belastung"],
  ["pemLatenz", "stunden"],
  ["pemErholung", "tage"],
  ["dauer", "ja"],
  ["schmerz", ["muskel"]],
  ["schmerzausbreitung", "begrenzt"],
  ["schmerzschwere", "spuerbar"],
  ["kognitiv", []],
  ["autonom", ["orthostatisch"]],
  ["autonomHfDokumentiert", "nicht-getestet"],
  ["schlaf", ["unauffaellig"]],
  ["paraesthesien", "keine"],
  ["atembeschwerden", "keine"],
  ["diabetesStatus", "nein"],
  ["psychKomorbid", "nein"],
  ["medikation", "ja"],
  ["medikationWirkung", "keine-besserung"],
  ["bellScore", ""],
  ["alltagsverrichtungen", "selbststaendig"],
  ["arbeitsfaehigkeit", "ueber-6"],
  ["objektiveTests", "unbekannt"],
  ["funcapScore", "nein"],
  ["beruflicherKontext", "nein"],
];

let laufendeAntworten: Answers = {};
let vorherigesRemaining = progress(laufendeAntworten).remaining;
check("Start: remaining = Gesamtzahl", vorherigesRemaining === TOTAL, `${vorherigesRemaining}`);

for (const [id, value] of vollerPfad) {
  laufendeAntworten = { ...laufendeAntworten, [id]: value };
  const { remaining } = progress(laufendeAntworten);
  check(
    `Nach Beantwortung von "${String(id)}": remaining fällt oder bleibt gleich (nie nach oben)`,
    remaining <= vorherigesRemaining,
    `${vorherigesRemaining} -> ${remaining}`
  );
  vorherigesRemaining = remaining;
}
check("Nach vollständigem Durchlauf (alle 25 Fragen beantwortet): remaining = 0", vorherigesRemaining === 0, `${vorherigesRemaining}`);

console.log(`\n${failures === 0 ? "Alle Checks bestanden." : `${failures} Check(s) fehlgeschlagen.`}`);
process.exit(failures === 0 ? 0 : 1);
