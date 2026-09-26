// Regressionstest für die Tier-1-Kombinationslogik (lib/triage/scoring.ts) -
// bewusst GETRENNT von scripts/regression-test.mts: läuft komplett offline,
// ohne API-Key, ohne laufenden Server, da computeTriage() eine reine,
// deterministische Funktion ist (kein LLM, kein Netzwerk-Call).
//
// Hintergrund: Die Gesamt-GdB-Bildung bei mehreren gleichzeitigen Befunden
// (Boden-Prinzip aus VersMedV Teil A Nr. 3, siehe versmedv-gdb-gds.md) ist
// der Teil der Tier-1-Logik, der bislang nie systematisch gegen synthetische
// Mehrfachdiagnose-Fälle geprüft wurde. Ein erster solcher Test deckte einen
// echten Bug auf: Atembeschwerden/Diabetes-Böden prüften nur, ob die
// UNTERGRENZE die bisherige Spanne übersteigt, nicht die OBERGRENZE - ein
// Fall wie "Baseline 50-60, Atembeschwerden 50-70" wurde dadurch fälschlich
// als "kein Effekt" behandelt (50 > 50 ist falsch), obwohl 70 > 60 ist. Der
// Parästhesien-Block hatte denselben Fehler bereits vorher (siehe PR #47).
// Dieses Skript hält die drei Boden-Blöcke (Atembeschwerden, Diabetes,
// Parästhesien) und ihr Zusammenspiel dauerhaft gegen genau diese
// Fehlerklasse fest, statt sich auf Ad-hoc-Handtests zu verlassen.
//
// Ausführen: npx tsx scripts/triage-scoring-selftest.mts (oder `npm run
// test:triage`) - kein Server, kein ANTHROPIC_API_KEY nötig.

import { computeTriage } from "../lib/triage/scoring.ts";
import type { Answers, TriageResult } from "../lib/triage/types.ts";

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  const status = ok ? "OK  " : "FAIL";
  console.log(`[${status}] ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures += 1;
}

function checkRange(label: string, result: TriageResult, expectVon: number, expectBis: number): void {
  check(
    `${label}: GdB-Spanne ${expectVon}–${expectBis}`,
    result.gdbSpanneVon === expectVon && result.gdbSpanneBis === expectBis,
    `tatsächlich ${result.gdbSpanneVon}–${result.gdbSpanneBis}`
  );
}

function checkInternalConsistency(label: string, result: TriageResult): void {
  check(
    `${label}: interne Konsistenz (0 ≤ von ≤ bis ≤ 100)`,
    result.gdbSpanneVon >= 0 &&
      result.gdbSpanneBis <= 100 &&
      result.gdbSpanneVon <= result.gdbSpanneBis,
    `${result.gdbSpanneVon}–${result.gdbSpanneBis}`
  );
}

// Gemeinsame Basis: ein durchgehend milder ME/CFS-Verlauf ohne jeden
// Erhöhungsfaktor, damit die GdB-Spanne allein vom jeweils getesteten
// Boden-Block abhängt (Default-Baseline 30-40, siehe scoring.ts).
const MILD_BASELINE: Answers = {
  pem: "ja",
  pemErholung: "tage",
  dauer: "ja",
  schmerz: [],
  kognitiv: [],
  autonom: [],
  schlaf: ["nicht-erholsam"],
  paraesthesien: "keine",
  psychKomorbid: "nein",
  bellScore: "",
  alltagsverrichtungen: "selbststaendig",
  arbeitsfaehigkeit: "ueber-6",
  objektiveTests: "unbekannt",
  beruflicherKontext: "nein",
  atembeschwerden: "keine",
  diabetesStatus: "nein",
};

// Bell-Score 45 -> mittelschwere Baseline (50-60, siehe scoring.ts), damit
// sich Regressionsfälle testen lassen, bei denen die Obergrenze eines
// Boden-Blocks über der bisherigen Obergrenze liegt, die Untergrenze aber
// nicht über der bisherigen Untergrenze.
const MODERATE_BASELINE: Answers = { ...MILD_BASELINE, bellScore: "45" };

console.log("=== Regressionsfall: Atembeschwerden-Obergrenze wurde übergangen ===");
checkRange(
  "Baseline 50-60 + Atembeschwerden mittleren Grades (GdB 50-70)",
  computeTriage({ ...MODERATE_BASELINE, atembeschwerden: "leichte-belastung" }),
  50,
  70
);

console.log("\n=== Regressionsfall: Diabetes-Obergrenze wurde übergangen ===");
// insulin-stabil = GdB 30-40; bei einer Baseline von 50-60 liegt die
// Untergrenze (30) UNTER der bisherigen (50), darf also nichts ändern -
// das ist die Gegenprobe, dass der Fix nicht überkorrigiert.
checkRange(
  "Baseline 50-60 + Diabetes insulin-stabil (GdB 30-40, niedriger) - kein Effekt erwartet",
  computeTriage({ ...MODERATE_BASELINE, diabetesStatus: "insulin-stabil" }),
  50,
  60
);
// insulin-instabil = GdB 50 (Einzelwert); bei einer milden Baseline von
// 30-40 muss das anheben (50 > 30 UND 50 > 40).
checkRange(
  "Milde Baseline 30-40 + Diabetes insulin-instabil (GdB 50) - sollte anheben",
  computeTriage({ ...MILD_BASELINE, diabetesStatus: "insulin-instabil" }),
  50,
  50
);

console.log("\n=== Regressionsfall: Parästhesien-Boden konnte nie greifen (PR #47) ===");
checkRange(
  "Milde Baseline 30-40 + Parästhesien deutlich-mit-Schwäche (GdB 30-50) - sollte Obergrenze anheben",
  computeTriage({ ...MILD_BASELINE, paraesthesien: "deutlich-mit-schwaeche" }),
  30,
  50
);
checkRange(
  "Milde Baseline 30-40 + Parästhesien leicht (GdB 10-20) - kein Effekt erwartet",
  computeTriage({ ...MILD_BASELINE, paraesthesien: "leicht" }),
  30,
  40
);

console.log("\n=== Mehrfachdiagnose-Stresstest: mehrere Böden + alle Erhöhungsfaktoren gleichzeitig ===");
const maximalfall: Answers = {
  ...MILD_BASELINE,
  pem: "ja",
  pemTriggerart: ["koerperlich", "geistig"],
  pemAusloeseschwelle: "leichteste-alltagsbelastung",
  pemErholung: "ueber-monat",
  schmerz: ["muskel", "gelenk", "kopf-neu"],
  schmerzausbreitung: "generalisiert",
  schmerzschwere: "kaum-auszuhalten",
  kognitiv: ["konzentration", "gedaechtnis", "wortfindung", "verarbeitung"],
  autonom: ["orthostatisch"],
  autonomHfDokumentiert: "ja",
  paraesthesien: "deutlich-mit-schwaeche",
  psychKomorbid: "ja-gesichert",
  alltagsverrichtungen: "bettlaegerig-nah",
  arbeitsfaehigkeit: "unter-3",
  objektiveTests: "auffaellig",
  atembeschwerden: "ruhe",
  diabetesStatus: "insulin-instabil",
};
const maxResult = computeTriage(maximalfall);
checkInternalConsistency("Maximalfall (alle Böden + alle Erhöhungsfaktoren)", maxResult);
check(
  "Maximalfall bleibt innerhalb der schweren Spanne (80-100, kein Überlauf über 100)",
  maxResult.gdbSpanneVon === 80 && maxResult.gdbSpanneBis === 100,
  `tatsächlich ${maxResult.gdbSpanneVon}–${maxResult.gdbSpanneBis}`
);

console.log("\n=== Zwei mittelstarke Böden gleichzeitig - der höhere darf nicht vom niedrigeren verdrängt werden ===");
checkRange(
  "Diabetes insulin-stabil (30-40) + Parästhesien deutlich (20-30), milde Baseline",
  computeTriage({
    ...MILD_BASELINE,
    diabetesStatus: "insulin-stabil",
    paraesthesien: "deutlich",
  }),
  30,
  40
);

console.log("\n=== Medikation/Therapieansprechen wirkt nur dokumentierend, nie auf die GdB-Zahlen ===");
// Bewusste Design-Entscheidung (siehe scoring.ts-Kommentar zum Medikations-
// Block): "keine Besserung trotz Medikation" ist laut Kalibrierungsmatrix
// (ccc-fragenkatalog-kalibrierung.md Abschnitt 8) ein Hinweis auf eine
// höhere Einstufung, wird hier aber bewusst NICHT als eigener numerischer
// Erhöhungsfaktor verrechnet. Dieser Test hält fest, dass sich die
// GdB-Spanne durch keine Kombination aus medikation/medikationWirkung
// ändert - falls das künftig geändert wird, muss dieser Test bewusst
// angepasst werden, statt unbemerkt durchzurutschen.
const milde = computeTriage(MILD_BASELINE);
checkRange("Milde Baseline ohne Medikationsangabe (Referenzwert)", milde, 30, 40);
checkRange(
  "Milde Baseline + keine Medikation",
  computeTriage({ ...MILD_BASELINE, medikation: "nein" }),
  30,
  40
);
checkRange(
  "Milde Baseline + Medikation ohne Besserung",
  computeTriage({ ...MILD_BASELINE, medikation: "ja", medikationWirkung: "keine-besserung" }),
  30,
  40
);
checkRange(
  "Milde Baseline + Medikation mit deutlicher Besserung",
  computeTriage({ ...MILD_BASELINE, medikation: "ja", medikationWirkung: "deutliche-besserung" }),
  30,
  40
);

console.log(`\n${failures === 0 ? "Alle Checks bestanden." : `${failures} Check(s) fehlgeschlagen.`}`);
process.exit(failures === 0 ? 0 : 1);
