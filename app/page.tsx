"use client";

import { useEffect, useState } from "react";
import {
  PATIENT_TITLE,
  PATIENT_SUBTITLE,
  DIAGNOSIS_WARNING,
  CRISIS_NOTE,
  PATIENT_ABOUT_TEXT as ABOUT_TEXT,
} from "@/lib/content";
import { emptyStage1Answers, emptyStage2Answers, type Stage1Answers, type Stage2Answers } from "@/lib/interviewAnswers";
import Stage1Form from "./Stage1Form";
import Stage2Form from "./Stage2Form";
import DetailedAnalysisFlow from "./DetailedAnalysisFlow";

// Zwei Varianten, je nach Kill-Switch (lib/paywall.ts, per GET /api/pricing
// abgefragt) — bei deaktiviertem Kill-Switch (Default) gibt es keine
// Zahlungs-/Speicher-Stufe, die Behauptung müsste sonst falsch werden (siehe
// commit 274e91c, keine falschen No-Storage-Zusagen).
const STORAGE_NOTICE_PAYWALL_ON =
  "Ihre Angaben werden zur Erstellung der kostenlosen Schnell-Einschätzung an unseren KI-Anbieter (Anthropic) zur Verarbeitung übermittelt. Auf unseren eigenen Servern speichern wir sie nicht darüber hinaus. Nur falls Sie anschließend die kostenpflichtige Detailanalyse abschicken, wird Ihr Fragebogen vorübergehend (bis zu 2 Stunden) serverseitig gespeichert, um die Zahlungsbestätigung zu ermöglichen — danach automatisch gelöscht.";
const STORAGE_NOTICE_PAYWALL_OFF =
  "Ihre Angaben werden zur Erstellung der Einschätzung an unseren KI-Anbieter (Anthropic) zur Verarbeitung übermittelt. Auf unseren eigenen Servern speichern wir sie nicht darüber hinaus.";

// Bewusst keine Resume-/Pausierbarkeits-Zusage: der Fragebogen ist EINMALIG
// und zustandslos, exakt wie der Rest der App (kein neuer Persistenz-Layer).
// Kürze ist hier die PEM-Schutzmaßnahme, nicht Pausierbarkeit — siehe README.
const NO_RESUME_NOTICE =
  "Ihre Antworten werden nicht gespeichert, solange Sie das Interview nicht abschließen — wenn Sie die Seite schließen, müssen Sie von vorn beginnen. Nehmen Sie sich die Zeit, die Sie brauchen, und lassen Sie Fragen aus, die Sie gerade nicht beantworten möchten oder können.";

type Phase = "gate" | "warned" | "ended" | "stage1" | "stage1-result" | "stage2" | "stage2-result";

export default function App() {
  const [phase, setPhase] = useState<Phase>("gate");
  const [diagnosisConfirmed, setDiagnosisConfirmed] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  // Default false = Kill-Switch aus (siehe lib/paywall.ts) - passt zum
  // tatsächlichen Server-Default, falls die Abfrage unten noch nicht
  // zurück ist, zeigt die Gate-Seite also nicht kurz die falsche Variante.
  const [paywallEnabled, setPaywallEnabled] = useState(false);

  const [stage1, setStage1] = useState<Stage1Answers>(emptyStage1Answers());
  const [stage1Loading, setStage1Loading] = useState(false);
  const [stage1Error, setStage1Error] = useState<string | null>(null);
  const [quickVerdict, setQuickVerdict] = useState<string | null>(null);

  const [stage2, setStage2] = useState<Stage2Answers>(emptyStage2Answers());

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data: { paywallEnabled?: boolean }) => setPaywallEnabled(!!data.paywallEnabled))
      .catch(() => setPaywallEnabled(false));
  }, []);

  function startInterview(confirmed: boolean) {
    setDiagnosisConfirmed(confirmed);
    setPhase("stage1");
  }

  async function submitStage1() {
    setStage1Loading(true);
    setStage1Error(null);
    try {
      const response = await fetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage1, diagnosisConfirmed }),
      });
      let data: { text?: string; error?: string };
      try {
        data = await response.json();
      } catch {
        throw new Error(
          response.status === 504
            ? "Zeitüberschreitung bei der Erstellung. Bitte in ein bis zwei Minuten erneut versuchen."
            : `Der Server hat keine gültige Antwort geliefert (HTTP ${response.status}).`
        );
      }
      if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);
      setQuickVerdict(data.text ?? "");
      setPhase("stage1-result");
    } catch (e) {
      setStage1Error("Technisches Problem: " + (e instanceof Error ? e.message : "unbekannter Fehler"));
    } finally {
      setStage1Loading(false);
    }
  }

  return (
    <div style={styles.centerWrap}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>{PATIENT_TITLE}</h1>
          <p style={styles.subtitle}>{PATIENT_SUBTITLE}</p>
          <button style={styles.aboutLink} onClick={() => setAboutOpen((o) => !o)}>
            {aboutOpen ? "Über BASTET ausblenden" : "ℹ️ Über BASTET / Rechtliches"}
          </button>
          {aboutOpen && <div style={styles.aboutPanel}>{ABOUT_TEXT}</div>}
        </header>

        {phase === "gate" && (
          <div style={styles.gateCard}>
            <p style={styles.noticeText}>{paywallEnabled ? STORAGE_NOTICE_PAYWALL_ON : STORAGE_NOTICE_PAYWALL_OFF}</p>
            <div style={styles.divider} />
            <p style={styles.gateQuestion}>
              Ist bei Ihnen ein Post-COVID-Syndrom bzw. ME/CFS bereits ärztlich diagnostiziert bzw. gesichert?
            </p>
            <div style={styles.buttonRow}>
              <button style={styles.primaryButton} onClick={() => startInterview(true)}>
                Ja, gesichert
              </button>
              <button style={styles.secondaryButton} onClick={() => setPhase("warned")}>
                Nein / unklar
              </button>
            </div>
          </div>
        )}

        {phase === "warned" && (
          <div style={styles.gateCard}>
            <p style={styles.warningText}>{DIAGNOSIS_WARNING}</p>
            <p style={styles.bodyText}>
              Möchten Sie trotzdem eine rein orientierende Einschätzung erhalten (deutlich als "Diagnose nicht
              gesichert" markiert), oder lieber zunächst eine ärztliche Abklärung anstoßen?
            </p>
            <div style={styles.buttonRow}>
              <button style={styles.secondaryButton} onClick={() => startInterview(false)}>
                Trotzdem orientierende Einschätzung
              </button>
              <button style={styles.primaryButton} onClick={() => setPhase("ended")}>
                Ich möchte erst zum Arzt
              </button>
            </div>
          </div>
        )}

        {phase === "ended" && (
          <div style={styles.gateCard}>
            <p style={styles.bodyText}>
              Das ist der richtige erste Schritt. Anlaufstellen für eine Abklärung: Ihre Hausarztpraxis, eine
              Long-COVID-Ambulanz in Ihrer Nähe (Übersichten führen z. B. die Landesärztekammern), oder bei Verdacht
              auf ME/CFS eine auf diese Erkrankung spezialisierte Ambulanz. Dieser Fragebogen speichert nichts — Sie
              können jederzeit zurückkehren, sobald eine Diagnose vorliegt.
            </p>
          </div>
        )}

        {phase === "stage1" && (
          <>
            <p style={styles.noResumeNotice}>{NO_RESUME_NOTICE}</p>
            <Stage1Form answers={stage1} onChange={(patch) => setStage1((a) => ({ ...a, ...patch }))} onSubmit={submitStage1} loading={stage1Loading} />
            {stage1Error && (
              <div style={styles.errorBox}>
                {stage1Error}
                <div style={{ marginTop: 8 }}>
                  <button style={styles.secondaryButton} onClick={submitStage1} disabled={stage1Loading}>
                    Erneut versuchen
                  </button>
                </div>
              </div>
            )}
            <p style={styles.crisisNote}>{CRISIS_NOTE}</p>
          </>
        )}

        {phase === "stage1-result" && quickVerdict && (
          <div style={styles.gateCard}>
            <p style={{ ...styles.bodyText, marginTop: 0, whiteSpace: "pre-wrap" }}>{quickVerdict}</p>
            <div style={styles.divider} />
            <p style={styles.bodyText}>
              Die Detailanalyse umfasst ca. 19 weitere Fragen, viele davon Auswahlfragen — dauert erfahrungsgemäß
              10–15 Minuten. {NO_RESUME_NOTICE}
            </p>
            <div style={styles.buttonRow}>
              <button style={styles.primaryButton} onClick={() => setPhase("stage2")}>
                Detailanalyse ausfüllen
              </button>
            </div>
          </div>
        )}

        {phase === "stage2" && (
          <>
            <Stage2Form
              stage1={stage1}
              answers={stage2}
              onChange={(patch) => setStage2((a) => ({ ...a, ...patch }))}
              onSubmit={() => setPhase("stage2-result")}
              loading={false}
            />
            <p style={styles.crisisNote}>{CRISIS_NOTE}</p>
          </>
        )}

        {phase === "stage2-result" && (
          <DetailedAnalysisFlow stage1={stage1} stage2={stage2} diagnosisConfirmed={diagnosisConfirmed} paywallEnabled={paywallEnabled} />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  centerWrap: { display: "flex", justifyContent: "center", padding: "28px 16px 40px", flex: 1 },
  container: { width: "100%", maxWidth: 640 },
  header: { marginBottom: 22 },
  title: {
    fontSize: 23,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.3,
    color: "var(--gold)",
    letterSpacing: "0.01em",
    textShadow: "0 0 24px rgba(201,168,76,.25)",
  },
  subtitle: { fontSize: 15.5, lineHeight: 1.6, color: "var(--text-muted)", marginTop: 8 },
  aboutLink: {
    marginTop: 10,
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    fontSize: 12.5,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
  aboutPanel: {
    marginTop: 10,
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "12px 14px",
    fontSize: 12.5,
    lineHeight: 1.6,
    color: "var(--text-muted)",
    whiteSpace: "pre-wrap",
  },
  gateCard: {
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border-gold)",
    borderRadius: 16,
    padding: "24px 22px",
  },
  noticeText: { fontSize: 16, lineHeight: 1.65, color: "var(--text)", margin: 0, fontWeight: 500 },
  warningText: {
    fontSize: 16,
    lineHeight: 1.65,
    color: "var(--gold-light)",
    background: "var(--gold-dim)",
    border: "1px solid var(--border-gold)",
    borderRadius: 12,
    padding: "12px 14px",
    margin: 0,
  },
  bodyText: { fontSize: 16, lineHeight: 1.65, color: "var(--text-muted)", marginTop: 14 },
  divider: { height: 1, background: "var(--border)", margin: "18px 0" },
  gateQuestion: { fontSize: 17, lineHeight: 1.6, fontWeight: 600, margin: 0, color: "var(--text)" },
  buttonRow: { display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" },
  primaryButton: {
    flex: "1 1 200px",
    background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
    color: "var(--dark2)",
    border: "none",
    borderRadius: 999,
    padding: "12px 20px",
    fontSize: 15.5,
    fontWeight: 700,
    cursor: "pointer",
    textAlign: "center",
  },
  secondaryButton: {
    flex: "1 1 200px",
    background: "rgba(255,255,255,.05)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "12px 20px",
    fontSize: 15.5,
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
  },
  noResumeNotice: {
    fontSize: 13,
    lineHeight: 1.55,
    color: "var(--text-faint)",
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "10px 14px",
    marginBottom: 14,
  },
  errorBox: {
    marginTop: 12,
    background: "rgba(248,113,113,.08)",
    border: "1px solid rgba(248,113,113,.35)",
    color: "var(--danger)",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 15,
  },
  crisisNote: { fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.5, marginTop: 14 },
};
