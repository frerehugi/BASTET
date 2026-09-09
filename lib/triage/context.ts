import type { Answers } from "./types";
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
