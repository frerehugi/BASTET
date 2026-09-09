"use client";

import { useState } from "react";
import type { Answers, QuestionId } from "@/lib/triage/types";
import { QUESTIONS, nextQuestion, progress } from "@/lib/triage/questions";
import { computeTriage } from "@/lib/triage/scoring";
import { formatTriageSummary } from "@/lib/triage/summary";

interface TriageFlowProps {
  onComplete: (answers: Answers, summaryText: string, empfehlungDetailanalyse: boolean) => void;
}

/**
 * Tier 1: regelbasierte Ersteinschätzung. Bewusst OHNE jeden Netzwerk-Call -
 * jede Frage/Auswertung läuft rein im Browser (lib/triage/*). Das ist der
 * Baustein, der beliebig viele parallele Nutzer:innen tragen kann, ohne
 * Anthropic-Kontingent oder Serverzeit zu verbrauchen.
 */
export default function TriageFlow({ onComplete }: TriageFlowProps) {
  const [answers, setAnswers] = useState<Answers>({});
  // Laufende Mehrfachauswahl der aktuell angezeigten Multi-Frage, getrennt von
  // `answers`: `answers[id]` darf erst beim "Weiter"-Klick gesetzt werden,
  // sonst hält nextQuestion() die Frage schon nach der ersten Option-Auswahl
  // für beantwortet und springt vorzeitig zur nächsten Frage.
  const [draft, setDraft] = useState<string[]>([]);

  const current = nextQuestion(answers);
  const { done, total } = progress(answers);

  function answerSingle(id: QuestionId, value: string) {
    const next = { ...answers, [id]: value };
    setAnswers(next);
    maybeFinish(next);
  }

  function toggleMulti(value: string) {
    setDraft((existing) => {
      if (value === "keine") {
        return existing.includes("keine") ? [] : ["keine"];
      }
      const withoutKeine = existing.filter((v) => v !== "keine");
      return withoutKeine.includes(value)
        ? withoutKeine.filter((v) => v !== value)
        : [...withoutKeine, value];
    });
  }

  function confirmMulti(id: QuestionId) {
    // Multi-Select braucht einen expliziten "Weiter"-Klick, da mehrere
    // Optionen zutreffen können - anders als bei single-select, wo die
    // Auswahl selbst schon der Bestätigungsklick ist.
    const next = { ...answers, [id]: draft };
    setAnswers(next);
    setDraft([]);
    maybeFinish(next);
  }

  function maybeFinish(current: Answers) {
    if (nextQuestion(current) === null) {
      const result = computeTriage(current);
      const text = formatTriageSummary(current, result);
      onComplete(current, text, result.empfehlungDetailanalyse);
    }
  }

  if (!current) return null; // Elternkomponente übernimmt sofort nach onComplete

  return (
    <div style={styles.card}>
      <div style={styles.progressLine}>
        Frage {done + 1} von {total}
      </div>
      <p style={styles.prompt}>{current.prompt}</p>
      {current.hint && <p style={styles.hint}>{current.hint}</p>}

      {current.type === "single" && (
        <div style={styles.optionGrid}>
          {current.options.map((opt) => (
            <button
              key={opt.value}
              style={styles.optionButton}
              onClick={() => answerSingle(current.id, opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {current.type === "multi" && (
        <>
          <div style={styles.optionGrid}>
            {current.options.map((opt) => {
              const selected = draft.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  style={selected ? styles.optionButtonSelected : styles.optionButton}
                  onClick={() => toggleMulti(opt.value)}
                >
                  {selected ? "✓ " : ""}
                  {opt.label}
                </button>
              );
            })}
          </div>
          <button
            style={styles.continueButton}
            onClick={() => confirmMulti(current.id)}
            disabled={draft.length === 0}
          >
            Weiter
          </button>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border-gold)",
    borderRadius: 16,
    padding: "24px 22px",
  },
  progressLine: { fontSize: 13.5, color: "var(--text-faint)", marginBottom: 14, letterSpacing: 0.1 },
  prompt: { fontSize: 17, lineHeight: 1.6, fontWeight: 600, margin: 0, color: "var(--text)" },
  hint: { fontSize: 13.5, lineHeight: 1.5, color: "var(--text-muted)", marginTop: 6 },
  optionGrid: { display: "flex", flexDirection: "column", gap: 10, marginTop: 18 },
  optionButton: {
    background: "rgba(255,255,255,.05)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "13px 16px",
    fontSize: 15.5,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "left",
  },
  optionButtonSelected: {
    background: "var(--gold-dim)",
    color: "var(--gold-light)",
    border: "1px solid var(--border-gold)",
    borderRadius: 12,
    padding: "13px 16px",
    fontSize: 15.5,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "left",
  },
  continueButton: {
    marginTop: 14,
    width: "100%",
    background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
    color: "var(--dark2)",
    border: "none",
    borderRadius: 999,
    padding: "13px 20px",
    fontSize: 15.5,
    fontWeight: 700,
    cursor: "pointer",
  },
};

// QUESTIONS wird hier nicht direkt verwendet, aber re-exportiert lassen,
// damit ein zukünftiger Fortschrittsbalken (z.B. Punkte pro Domäne) ohne
// weiteren Import in questions.ts auskommt.
export { QUESTIONS };
