import type { Answers, TriageResult } from "./types";
import { QUESTIONS } from "./questions";

/**
 * Kompakte, für das LLM lesbare Zusammenfassung der Tier-1-Antworten - wird
 * NICHT den Nutzer:innen angezeigt, sondern nur in den Tier-2-System-Prompt
 * eingebettet (siehe lib/chat.ts), damit die Detailanalyse die bereits
 * strukturiert erhobenen Punkte nicht erneut abfragt. Genau das war der
 * ursprüngliche Auslöser dieses Umbaus: "es tauchen großteils die gleichen
 * Fragen wieder auf".
 */
export function answersToContextText(answers: Answers): string {
  const lines: string[] = [];
  for (const q of QUESTIONS) {
    const raw = answers[q.id];
    if (raw === undefined) continue;
    const values = Array.isArray(raw) ? raw : [raw];
    const labels = values.map((v) => q.options.find((o) => o.value === v)?.label ?? v);
    lines.push(`${q.prompt} → ${labels.join("; ")}`);
  }
  return lines.join("\n");
}

const EMR_LABELS: Record<TriageResult["emrKategorie"], string> = {
  keine: "keine Erwerbsminderung (Leistungsvermögen ≥6 Std./Tag)",
  teilweise: "teilweise Erwerbsminderung (Leistungsvermögen 3 bis unter 6 Std./Tag)",
  voll: "volle Erwerbsminderung (Leistungsvermögen unter 3 Std./Tag)",
  nicht_erhoben: "nicht erhoben",
};

/**
 * Formatiert das bereits von computeTriage() berechnete Ergebnis (GdB-Spanne,
 * MdE-Einschlägigkeit, EMR-Kategorie inkl. Begründungen) als Zusatzblock für
 * den Tier-2-System-Prompt (siehe lib/chat.ts) - bislang kam bei Tier 2 nur
 * answersToContextText() (die rohen Frage-Antwort-Paare) an, obwohl Tier 1
 * dieselben Antworten bereits deterministisch zu einer Spannen-/Kategorie-
 * Einschätzung verrechnet (siehe lib/triage/scoring.ts). Ohne diesen Block
 * rekonstruiert das Modell bei jeder Auswertung dieselbe Spannenfindung neu,
 * was Streuung zwischen ähnlichen Fällen begünstigt (siehe
 * build/effizienz-plan.md Abschnitt 6). Bewusst als Kalibrierungsanker
 * formuliert, nicht als bindende Vorgabe - Tier 1 kennt nur die Rohantworten,
 * nicht die Detailinformationen aus der Tier-2-Gesprächsvertiefung.
 */
export function triageResultToPromptAnchor(result: TriageResult): string {
  const mdeLabel = result.mdeEinschlaegig ? "einschlägig (dem Grunde nach)" : "nicht einschlägig";
  return `TIER-1-VORAB-EINSCHÄTZUNG (regelbasiert berechnet, kein LLM beteiligt):
- GdB-Spanne: ${result.gdbSpanneVon}–${result.gdbSpanneBis}. Begründung: ${result.gdbBegruendung.join(" ")}
- MdE: ${mdeLabel}. ${result.mdeGrund}
- EMR: ${EMR_LABELS[result.emrKategorie]}. ${result.emrBegruendung}

Das ist ein Kalibrierungsanker und Ausgangspunkt, KEINE bindende
Vorentscheidung: Tier 1 kennt nur die Rohantworten oben, nicht die
Detailinformationen aus der folgenden Gesprächsvertiefung. Weiche davon ab,
wenn die Gesprächsdetails das rechtfertigen — nenne dann aber explizit, warum
du von der Tier-1-Spanne abweichst.`;
}
