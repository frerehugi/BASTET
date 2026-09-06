"use client";

import { useState } from "react";
import { splitReferences } from "@/lib/format";

const ABOUT_TEXT = `BASTET ist ein Orientierungs- und Hilfsangebot, keine verbindliche Begutachtung, keine medizinische Diagnose und keine Rechtsberatung. Es ersetzt weder eine ärztliche Untersuchung noch anwaltliche Beratung und bindet keine Behörde, kein Gericht und keinen Versicherungsträger.

BASTET basiert auf großen Sprachmodellen (LLMs) und einer kuratierten Wissensbasis. Diese Technologie befindet sich in aktiver Forschung und Entwicklung, ist experimentell, und fehlerhafte oder unvollständige Ausgaben sind nicht auszuschließen. Für Vollständigkeit, Richtigkeit und Aktualität der Inhalte wird keine Gewähr übernommen. Alle Ausgaben dienen ausschließlich der fachlichen Orientierung — die eigene fachliche Beurteilung bleibt maßgeblich.

Soweit gesetzlich zulässig, ist eine Haftung für Schäden aus der Nutzung von BASTET ausgeschlossen; dies gilt nicht bei Verletzung von Leben, Körper oder Gesundheit sowie nicht bei Vorsatz oder grober Fahrlässigkeit.

© Schmitz & Hugenberg, Osnabrück. Alle Rechte vorbehalten — an Name, Marke, Quellcode und den redaktionell erstellten Inhalten (u. a. die kuratierte Wissensbasis). Das Repository ist öffentlich einsehbar, insbesondere für die Teilnahme an Hackathons; öffentliche Einsehbarkeit bedeutet nicht automatisch eine Open-Source-Lizenzierung. "Open Source" bezieht sich auf die zugrunde liegenden Quellen und Daten (u. a. VersMedV als amtliches Werk gemäß § 5 UrhG, Kanadische Konsenskriterien, veröffentlichte Sozialgerichtsentscheidungen) — deren Auswahl und Verknüpfung innerhalb von BASTET ist eine eigenständige redaktionelle Leistung.

BASTET ist ein Forschungsprojekt im Aufbau — Funktionsumfang und Wissensbasis entwickeln sich fortlaufend weiter.`;

interface FieldDef {
  key: "beruf" | "anamnese";
  label: string;
  placeholder: string;
  rows: number;
}

const FIELD_DEFS: FieldDef[] = [
  {
    key: "beruf",
    label: "Beruflicher Kontext / BK-3101",
    placeholder: "Tätigkeit, Datum akute Infektion, BK-3101-Status (nicht gemeldet/offen/anerkannt)",
    rows: 2,
  },
  {
    key: "anamnese",
    label: "Anamnese (frei)",
    placeholder: "Verlauf seit der Infektion, bisherige Diagnostik/Therapie, Vorerkrankungen",
    rows: 2,
  },
];

interface CccField {
  key: string;
  label: string;
  options: string[];
  multi?: boolean;
}

// Trennzeichen für mehrfach ausgewählte Chip-Optionen im ccc-State (siehe
// `multi`-Felder unten) - bewusst kein Komma, da Optionstexte selbst Kommata
// enthalten könnten.
const MULTI_SEPARATOR = " + ";
interface CccGroup {
  key: string;
  title: string;
  fields: CccField[];
  freeKey?: string;
  freeLabel?: string;
}

const CCC_GROUPS: CccGroup[] = [
  {
    key: "pem",
    title: "PEM (zwingendes Leitsymptom)",
    fields: [
      { key: "pem_ausloeser", label: "Auslöseschwelle", options: ["leichteste Alltagsbelastung", "mittelschwere Belastung", "nur starke Belastung", "kein PEM erkennbar"] },
      { key: "pem_latenz", label: "Latenz bis Verschlechterung", options: ["sofort", "Stunden", "1–3 Tage", "unklar"] },
      { key: "pem_erholung", label: "Erholungsdauer", options: ["Stunden", "Tage", ">1 Woche", ">1 Monat"] },
    ],
  },
  {
    key: "fatigue",
    title: "Fatigue / Alltagsfunktion",
    fields: [
      { key: "fatigue_arbeit", label: "Arbeitsfähigkeit", options: ["voll", "reduziert", "arbeitsunfähig"] },
      { key: "fatigue_alltag", label: "Alltagsverrichtungen", options: ["selbstständig", "mit Unterstützung", "bettlägerig-nah"] },
    ],
    freeKey: "fatigue_bell",
    freeLabel: "Bell-Score, falls erhoben (0–100)",
  },
  {
    key: "schlaf",
    title: "Schlaf",
    fields: [
      { key: "schlaf_art", label: "Art der Störung", options: ["nicht erholsam", "Ein-/Durchschlafstörung", "Tag-Nacht-Umkehr", "unauffällig"], multi: true },
      { key: "schlaf_tag", label: "Auswirkung tagsüber", options: ["keine relevante", "spürbar", "erheblich"] },
    ],
  },
  {
    key: "schmerz",
    title: "Schmerzen",
    fields: [
      { key: "schmerz_lok", label: "Lokalisation", options: ["Muskeln", "Gelenke (o. Schwellung)", "Kopf (neuer Typ)", "diffus", "keine"], multi: true },
      { key: "schmerz_therapie", label: "Therapieansprechen", options: ["gut", "teilweise", "therapieresistent", "keine Therapie"] },
    ],
  },
  {
    key: "kognitiv",
    title: "Neurokognitive Symptome",
    fields: [
      { key: "kog_konzentration", label: "Konzentration/Gedächtnis", options: ["keine", "leicht", "deutlich alltagsrelevant"] },
      { key: "kog_wortfindung", label: "Wortfindung", options: ["keine", "gelegentlich", "häufig, kommunikationsrelevant"] },
      { key: "kog_reize", label: "Reizüberempfindlichkeit", options: ["keine", "Licht", "Geräusche", "beides"] },
      { key: "kog_gang", label: "Gang-/Koordinationsstörung", options: ["keine", "leicht", "deutlich (Hilfsmittel)"] },
    ],
    freeKey: "kog_test",
    freeLabel: "Neuropsychologische Testung (Ergebnis, falls vorhanden)",
  },
  {
    key: "autonom",
    title: "Autonom / Kreislauf (inkl. POTS)",
    fields: [
      { key: "auto_orthostase", label: "Orthostatische Beschwerden", options: ["keine", "Schwindel im Stehen", "Präsynkope", "Synkope"] },
      { key: "auto_hf", label: "HF-Anstieg im Stehen dokumentiert?", options: ["ja, ≥30 bpm / ≥120 bpm", "nein", "nicht getestet"] },
      { key: "auto_temp", label: "Temperaturregulation", options: ["unauffällig", "gestört"] },
    ],
  },
  {
    key: "psyche",
    title: "Psychische Komorbidität",
    fields: [
      { key: "psy_diagnose", label: "Eigenständige psychiatrische Diagnose?", options: ["nein, nur reaktive Belastung", "ja, fachärztlich gesichert", "ja, nicht fachärztlich gesichert"] },
    ],
    freeKey: "psy_welche",
    freeLabel: "Falls ja: welche (z.B. F32/F33/F43.2/F41.1)",
  },
  {
    key: "medikation",
    title: "Medikation",
    fields: [
      { key: "med_ansprechen", label: "Therapieansprechen (Symptomkontrolle gesamt)", options: ["gut", "teilweise", "kein Ansprechen", "keine Medikation"] },
    ],
    freeKey: "med_liste",
    freeLabel: "Aktuelle Medikation (Wirkstoffgruppen)",
  },
  {
    key: "rahmen",
    title: "Dauer",
    fields: [{ key: "dauer", label: "Symptomdauer", options: ["<6 Monate", "≥6 Monate"] }],
  },
];

function initialCccState(): Record<string, string> {
  const state: Record<string, string> = {};
  CCC_GROUPS.forEach((g) => {
    g.fields.forEach((f) => (state[f.key] = ""));
    if (g.freeKey) state[g.freeKey] = "";
  });
  return state;
}

export default function DocApp() {
  const [values, setValues] = useState<{ beruf: string; anamnese: string }>({ beruf: "", anamnese: "" });
  const [ccc, setCcc] = useState<Record<string, string>>(initialCccState());
  const [diagnosisCertain, setDiagnosisCertain] = useState<"gesichert" | "verdacht">("gesichert");
  const [result, setResult] = useState<string | null>(null);
  const [refsOpen, setRefsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  function isChipSelected(field: CccField, opt: string): boolean {
    const current = ccc[field.key] || "";
    return field.multi ? current.split(MULTI_SEPARATOR).includes(opt) : current === opt;
  }

  function toggleChip(field: CccField, opt: string) {
    setCcc((c) => {
      if (!field.multi) return { ...c, [field.key]: opt };
      const current = (c[field.key] || "").split(MULTI_SEPARATOR).filter(Boolean);
      const next = current.includes(opt) ? current.filter((v) => v !== opt) : [...current, opt];
      return { ...c, [field.key]: next.join(MULTI_SEPARATOR) };
    });
  }

  const canSubmit = values.anamnese.trim().length > 0 && ccc.dauer !== "";

  async function handleSubmit() {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRefsOpen(false);
    try {
      const cccLines = CCC_GROUPS.map((g) => {
        const parts = g.fields
          .map((f) => `${f.label}: ${ccc[f.key] || "nicht angegeben"}`)
          .join("; ");
        const free = g.freeKey && ccc[g.freeKey] ? ` | ${g.freeLabel}: ${ccc[g.freeKey]}` : "";
        return `${g.title} — ${parts}${free}`;
      }).join("\n");

      const userInput = `Beruflicher Kontext / BK-3101: ${values.beruf || "nicht angegeben"}
Anamnese: ${values.anamnese}
Diagnostische Sicherheit (Selbstangabe): ${diagnosisCertain === "gesichert" ? "Diagnose ärztlich gesichert" : "Diagnose noch nicht abschließend gesichert / Verdachtsdiagnose"}

Strukturierter CCC-Befund:
${cccLines}`;

      const response = await fetch("/api/doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput }),
      });
      let data: { text?: string; error?: string };
      try {
        data = await response.json();
      } catch {
        // Ein Plattform-Fehler (z.B. Vercel-Timeout) liefert eine eigene,
        // nicht-JSON-Fehlerseite statt unserer eigenen Fehlerbehandlung -
        // ohne diesen Fang landet hier ein kryptischer "Unexpected token"-
        // Parse-Fehler statt einer verständlichen Meldung.
        throw new Error(
          response.status === 504
            ? "Zeitüberschreitung bei der Erstellung — die Anfrage war vermutlich sehr umfangreich. Bitte in ein bis zwei Minuten erneut versuchen."
            : `Der Server hat keine gültige Antwort geliefert (HTTP ${response.status}).`
        );
      }
      if (!response.ok || data.error) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      setResult(data.text ?? "");
    } catch (e) {
      setError(
        "Technisches Problem: " +
          (e instanceof Error ? e.message : "unbekannter Fehler") +
          " — nichts wurde gespeichert, erneut versuchen."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setValues({ beruf: "", anamnese: "" });
    setCcc(initialCccState());
    setDiagnosisCertain("gesichert");
    setResult(null);
    setRefsOpen(false);
    setError(null);
  }

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard-API evtl. blockiert im eingebetteten Kontext - Button bleibt nutzbar
    }
  }

  const parsed = result ? splitReferences(result) : null;

  return (
    <div style={styles.centerWrap}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerTop}>
            <h1 style={styles.title}>BASTET · Doc</h1>
            <span style={styles.badge}>für Fachkolleg:innen</span>
          </div>
          <p style={styles.subtitle}>
            Anonymisierte Anamnese und Befund eingeben, orientierende GdB/MdE-Einschätzung mit Quellenangaben erhalten.
            Fachliche Zweitmeinung — ersetzt nicht die eigene Beurteilung.
          </p>
          <button style={styles.aboutLink} onClick={() => setAboutOpen((o) => !o)}>
            {aboutOpen ? "Über BASTET ausblenden" : "ℹ️ Über BASTET / Rechtliches"}
          </button>
          {aboutOpen && <div style={styles.aboutPanel}>{ABOUT_TEXT}</div>}
        </header>

        <div style={styles.dutyBanner}>
          <span style={styles.dutyText}>
            Erinnerung: Bei begründetem Verdacht auf eine Berufskrankheit besteht nach § 202 SGB VII eine
            unverzügliche Meldepflicht — unabhängig von dieser Einschätzung.
          </span>
          <a
            style={styles.dutyLink}
            href="https://www.dguv.de/medien/formtexte/aerzte/f_6000/f6000_ausfuellbar.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Zum Meldeformular (F 6000)
          </a>
        </div>

        <div style={styles.anonNotice}>
          Bitte keine Namen, Fallnummern oder seltene Zusatzmerkmale eingeben, die eine Zuordnung zu einer Person
          erlauben könnten. Ihre Eingabe wird zur Erstellung der Einschätzung an unseren KI-Anbieter (Anthropic)
          zur Verarbeitung übermittelt; auf unseren eigenen Servern speichern wir sie nicht darüber hinaus.
        </div>

        <div style={styles.form}>
          {FIELD_DEFS.map((f) => (
            <div key={f.key} style={styles.fieldGroup}>
              <label style={styles.label}>{f.label}</label>
              <textarea
                style={styles.textarea}
                rows={f.rows}
                placeholder={f.placeholder}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </div>
          ))}

          <div style={styles.cccDivider}>Strukturierter CCC-Befund</div>

          {CCC_GROUPS.map((g) => (
            <div key={g.key} style={styles.cccGroup}>
              <div style={styles.cccTitle}>{g.title}</div>
              {g.fields.map((f) => (
                <div key={f.key} style={styles.cccFieldRow}>
                  <span style={styles.cccFieldLabel}>{f.label}</span>
                  <div style={styles.chipRow}>
                    {f.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        style={isChipSelected(f, opt) ? styles.chipActive : styles.chip}
                        onClick={() => toggleChip(f, opt)}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {g.freeKey && (
                <input
                  style={styles.smallInput}
                  placeholder={g.freeLabel}
                  value={ccc[g.freeKey]}
                  onChange={(e) => setCcc((c) => ({ ...c, [g.freeKey as string]: e.target.value }))}
                />
              )}
            </div>
          ))}

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Diagnostische Sicherheit</label>
            <div style={styles.radioRow}>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  checked={diagnosisCertain === "gesichert"}
                  onChange={() => setDiagnosisCertain("gesichert")}
                />
                Diagnose ärztlich gesichert
              </label>
              <label style={styles.radioLabel}>
                <input
                  type="radio"
                  checked={diagnosisCertain === "verdacht"}
                  onChange={() => setDiagnosisCertain("verdacht")}
                />
                Verdachtsdiagnose / noch in Abklärung
              </label>
            </div>
          </div>

          <div style={styles.buttonRow}>
            <button
              style={{ ...styles.primaryButton, opacity: canSubmit && !loading ? 1 : 0.5 }}
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
            >
              {loading ? "Wird erstellt …" : "Einschätzung erstellen"}
            </button>
            <button style={styles.secondaryButton} onClick={handleReset} disabled={loading}>
              Zurücksetzen
            </button>
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}
        </div>

        {parsed && (
          <div style={styles.resultCard}>
            <div style={styles.resultBody}>{parsed.body}</div>
            <div style={styles.refsArea}>
              <button style={styles.refsButton} onClick={copyResult}>
                {copied ? "Kopiert ✓" : "Einschätzung kopieren"}
              </button>
              {parsed.refs && (
                <button style={{ ...styles.refsButton, marginLeft: 8 }} onClick={() => setRefsOpen((o) => !o)}>
                  {refsOpen ? "Referenzen ausblenden" : `Referenzen anzeigen (${parsed.refs.length})`}
                </button>
              )}
            </div>
            {refsOpen && parsed.refs && (
              <ul style={styles.refsList}>
                {parsed.refs.map((r, i) => (
                  <li key={i} style={styles.refsListItem}>
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  centerWrap: { display: "flex", justifyContent: "center", padding: "28px 16px 40px", flex: 1 },
  container: { width: "100%", maxWidth: 720 },
  header: { marginBottom: 18 },
  headerTop: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  title: {
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    color: "var(--gold)",
    letterSpacing: "0.01em",
    textShadow: "0 0 24px rgba(201,168,76,.25)",
  },
  badge: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "var(--gold-light)",
    background: "var(--gold-dim)",
    border: "1px solid var(--border-gold)",
    borderRadius: 999,
    padding: "3px 10px",
    textTransform: "uppercase",
    letterSpacing: "0.03em",
  },
  subtitle: { fontSize: 14.5, lineHeight: 1.55, color: "var(--text-muted)", marginTop: 8 },
  aboutLink: {
    marginTop: 8,
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    fontSize: 12,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
  aboutPanel: {
    marginTop: 8,
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 12,
    lineHeight: 1.55,
    color: "var(--text-muted)",
    whiteSpace: "pre-wrap",
  },
  dutyBanner: {
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border-gold)",
    borderRadius: 12,
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  dutyText: { fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)", flex: 1, minWidth: 220 },
  dutyLink: { fontSize: 13, fontWeight: 700, color: "var(--gold-light)", whiteSpace: "nowrap", textDecoration: "underline" },
  anonNotice: {
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "var(--gold-light)",
    background: "var(--gold-dim)",
    border: "1px solid var(--border-gold)",
    borderRadius: 12,
    padding: "8px 12px",
    marginBottom: 18,
  },
  form: {
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "20px 20px 16px",
  },
  fieldGroup: { marginBottom: 16 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 6 },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "9px 11px",
    fontSize: 14.5,
    lineHeight: 1.5,
    fontFamily: "inherit",
    resize: "vertical",
    color: "var(--text)",
  },
  radioRow: { display: "flex", gap: 20, flexWrap: "wrap" },
  radioLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "var(--text-muted)" },
  cccDivider: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--gold-light)",
    borderTop: "1px solid var(--border)",
    paddingTop: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  cccGroup: { marginBottom: 16, paddingBottom: 14, borderBottom: "1px solid var(--border)" },
  cccTitle: { fontSize: 13.5, fontWeight: 700, color: "var(--text)", marginBottom: 8 },
  cccFieldRow: { marginBottom: 8 },
  cccFieldLabel: { display: "block", fontSize: 12.5, color: "var(--text-faint)", marginBottom: 4 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    fontSize: 12.5,
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: 999,
    border: "1px solid var(--border)",
    background: "rgba(255,255,255,.04)",
    color: "var(--text-muted)",
    cursor: "pointer",
  },
  chipActive: {
    fontSize: 12.5,
    fontWeight: 700,
    padding: "5px 12px",
    borderRadius: 999,
    border: "1px solid var(--border-gold)",
    background: "var(--gold-dim)",
    color: "var(--gold-light)",
    cursor: "pointer",
  },
  smallInput: {
    width: "100%",
    boxSizing: "border-box",
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "7px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    color: "var(--text)",
    marginTop: 4,
  },
  buttonRow: { display: "flex", gap: 10, marginTop: 4 },
  primaryButton: {
    background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
    color: "var(--dark2)",
    border: "none",
    borderRadius: 999,
    padding: "10px 20px",
    fontSize: 14.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "rgba(255,255,255,.05)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "10px 18px",
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  errorBox: {
    marginTop: 12,
    background: "rgba(248,113,113,.08)",
    border: "1px solid rgba(248,113,113,.35)",
    color: "var(--danger)",
    borderRadius: 10,
    padding: "9px 12px",
    fontSize: 13.5,
  },
  resultCard: {
    marginTop: 16,
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border-gold)",
    borderRadius: 16,
    padding: "16px 18px",
  },
  resultBody: { fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text)" },
  refsArea: { marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 },
  refsButton: {
    background: "var(--gold-dim)",
    border: "1px solid var(--border-gold)",
    color: "var(--gold-light)",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  refsList: { marginTop: 8, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: "var(--text-muted)", width: "100%" },
  refsListItem: { marginBottom: 4 },
};
