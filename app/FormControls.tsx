"use client";

// Wiederverwendbare Eingabe-Bausteine für Stage1Form/Stage2Form — bewusst
// klein gehalten statt eines generischen Formular-Renderers, weil viele der
// 27 Fragen (siehe lib/interviewAnswers.ts) eigene, nicht-generische Formen
// haben (kombinierte Felder, bedingte Folgefragen). Reine Präsentations-
// komponenten, kein eigener State.

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>{title}</h3>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {hint && <p style={styles.fieldHint}>{hint}</p>}
      {children}
    </div>
  );
}

export function ChoiceGroup<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div style={styles.choiceRow}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={value === o.value ? styles.choiceButtonActive : styles.choiceButton}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function MultiSelectGroup({
  values,
  onToggle,
  options,
}: {
  values: string[];
  onToggle: (key: string) => void;
  options: readonly { key: string; label: string }[];
}) {
  return (
    <div style={styles.choiceRow}>
      {options.map((o) => {
        const active = values.includes(o.key);
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onToggle(o.key)}
            style={active ? styles.choiceButtonActive : styles.choiceButton}
          >
            {active ? "✓ " : ""}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SkippableTextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
}) {
  const skipped = value === null;
  return (
    <div>
      <textarea
        style={{ ...styles.textarea, opacity: skipped ? 0.5 : 1 }}
        value={skipped ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={skipped ? "Übersprungen" : placeholder}
        disabled={skipped}
        rows={2}
      />
      <button type="button" style={styles.skipButton} onClick={() => onChange(skipped ? "" : null)}>
        {skipped ? "Doch beantworten" : "Diese Frage überspringen"}
      </button>
    </div>
  );
}

export function YesNoDetail({
  value,
  onChange,
  yesLabel = "Ja",
  noLabel = "Nein",
}: {
  value: { ja: boolean; detail: string } | null;
  onChange: (v: { ja: boolean; detail: string } | null) => void;
  yesLabel?: string;
  noLabel?: string;
}) {
  return (
    <div>
      <div style={styles.choiceRow}>
        <button
          type="button"
          style={value?.ja === false ? styles.choiceButtonActive : styles.choiceButton}
          onClick={() => onChange({ ja: false, detail: "" })}
        >
          {noLabel}
        </button>
        <button
          type="button"
          style={value?.ja === true ? styles.choiceButtonActive : styles.choiceButton}
          onClick={() => onChange({ ja: true, detail: value?.detail ?? "" })}
        >
          {yesLabel}
        </button>
      </div>
      {value?.ja === true && (
        <input
          style={styles.textInput}
          value={value.detail}
          onChange={(e) => onChange({ ja: true, detail: e.target.value })}
          placeholder="Details (optional)"
        />
      )}
    </div>
  );
}

export const styles: Record<string, React.CSSProperties> = {
  section: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 14,
    padding: "16px 18px",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--gold-light)",
    margin: "0 0 12px 0",
  },
  sectionBody: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: 600, color: "var(--text)", lineHeight: 1.5 },
  fieldHint: { fontSize: 12, color: "var(--text-faint)", margin: 0, lineHeight: 1.5 },
  choiceRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  choiceButton: {
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    borderRadius: 999,
    padding: "7px 14px",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  choiceButtonActive: {
    background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
    border: "1px solid var(--border-gold)",
    color: "var(--dark2)",
    borderRadius: 999,
    padding: "7px 14px",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  textarea: {
    width: "100%",
    resize: "vertical",
    minHeight: 60,
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "10px 12px",
    fontSize: 14,
    fontFamily: "inherit",
    lineHeight: 1.5,
    color: "var(--text)",
  },
  textInput: {
    width: "100%",
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 14,
    fontFamily: "inherit",
    color: "var(--text)",
  },
  skipButton: {
    marginTop: 6,
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    fontSize: 12,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
};
