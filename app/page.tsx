"use client";

import { useEffect, useRef, useState } from "react";
import { splitReferences } from "@/lib/format";
import {
  PATIENT_TITLE,
  PATIENT_SUBTITLE,
  DIAGNOSIS_WARNING,
  CRISIS_NOTE,
  PATIENT_ABOUT_TEXT as ABOUT_TEXT,
} from "@/lib/content";
import {
  isMdeEinschlaegig,
  mentionsNonHealthSector,
  composeBgwLetter,
  formatDateDe,
  LETTER_SEND_HINT,
  OTHER_SECTOR_NOTICE,
  type LetterFields,
} from "@/lib/bgwLetter";

const STORAGE_NOTICE =
  "Ihre Angaben werden zur Erstellung der Einschätzung an unseren KI-Anbieter (Anthropic) zur Verarbeitung übermittelt. Auf unseren eigenen Servern speichern wir sie nicht darüber hinaus — mit Schließen dieses Fensters sind Ihre Angaben bei uns unwiderruflich weg, planen Sie die gut 15 Minuten möglichst am Stück ein.";

type Role = "user" | "assistant";
interface Message {
  role: Role;
  content: string;
}
type Phase = "gate" | "warned" | "chat" | "ended";

function useAutoScroll(dep: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [dep]);
  return ref;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("gate");
  const [diagnosisConfirmed, setDiagnosisConfirmed] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [lastHistory, setLastHistory] = useState<Message[] | null>(null);
  const [openRefs, setOpenRefs] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | "all" | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [letterOpen, setLetterOpen] = useState<Record<number, boolean>>({});
  const [letterFields, setLetterFields] = useState<Record<number, LetterFields>>({});
  const [generatedLetter, setGeneratedLetter] = useState<Record<number, string>>({});
  const [letterCopiedIndex, setLetterCopiedIndex] = useState<number | null>(null);

  function getLetterFields(i: number): LetterFields {
    return letterFields[i] ?? { name: "", address: "", date: formatDateDe(new Date()) };
  }
  function updateLetterField(i: number, patch: Partial<LetterFields>) {
    setLetterFields((prev) => ({ ...prev, [i]: { ...getLetterFields(i), ...patch } }));
  }
  function handleGenerateLetter(i: number, assessmentBody: string) {
    const fields = getLetterFields(i);
    setGeneratedLetter((prev) => ({ ...prev, [i]: composeBgwLetter(fields, assessmentBody) }));
  }
  async function copyLetter(i: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setLetterCopiedIndex(i);
      setTimeout(() => setLetterCopiedIndex(null), 2000);
    } catch {
      // wie copyText oben - stiller Fehlschlag, Button bleibt nutzbar
    }
  }

  async function copyText(text: string, markKey: number | "all") {
    try {
      await navigator.clipboard.writeText(text);
      if (markKey === "all") {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
      } else {
        setCopiedIndex(markKey);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
    } catch {
      // Clipboard-API kann in manchen eingebetteten Kontexten blockiert sein -
      // stiller Fehlschlag, Button bleibt nutzbar für den nächsten Versuch
    }
  }

  function fullTranscriptText() {
    return messages
      .map((m) => (m.role === "user" ? "Sie: " : "Assistent: ") + m.content)
      .join("\n\n---\n\n");
  }
  const scrollRef = useAutoScroll(messages.length);

  async function callChatApi(history: Message[]) {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          diagnosisConfirmed,
          turnCount,
        }),
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
      setMessages((m) => [...m, { role: "assistant", content: data.text ?? "" }]);
      setLastHistory(null);
    } catch (e) {
      setError(
        "Technisches Problem: " +
          (e instanceof Error ? e.message : "unbekannter Fehler") +
          " — Ihre Angaben sind noch da, unten können Sie es erneut versuchen."
      );
      setLastHistory(history);
    } finally {
      setLoading(false);
    }
  }

  function startChat(confirmed: boolean) {
    setDiagnosisConfirmed(confirmed);
    setPhase("chat");
    const opening: Message = {
      role: "assistant",
      content:
        "Danke. Erzählen Sie mir in eigenen Worten, was seit wann bei Ihnen los ist — Stichworte reichen völlig, Sie müssen keine ganzen Sätze schreiben.",
    };
    setMessages([opening]);
  }

  function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setTurnCount((c) => c + 1);
    callChatApi(next);
  }

  function forceEvaluation() {
    if (loading) return;
    const directive: Message = {
      role: "user",
      content:
        "[Bitte jetzt sofort mit den bisherigen Angaben die Auswertung erstellen. Markieren Sie, welche Punkte offen blieben.]",
    };
    const next = [...messages, directive];
    setMessages(next);
    callChatApi(next);
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
            <p style={styles.noticeText}>{STORAGE_NOTICE}</p>
            <div style={styles.divider} />
            <p style={styles.gateQuestion}>
              Ist bei Ihnen ein Post-COVID-Syndrom bzw. ME/CFS bereits ärztlich
              diagnostiziert bzw. gesichert?
            </p>
            <div style={styles.buttonRow}>
              <button style={styles.primaryButton} onClick={() => startChat(true)}>
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
              Möchten Sie trotzdem eine rein orientierende Einschätzung erhalten
              (deutlich als "Diagnose nicht gesichert" markiert), oder lieber
              zunächst eine ärztliche Abklärung anstoßen?
            </p>
            <div style={styles.buttonRow}>
              <button style={styles.secondaryButton} onClick={() => startChat(false)}>
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
              Das ist der richtige erste Schritt. Anlaufstellen für eine
              Abklärung: Ihre Hausarztpraxis, eine Long-COVID-Ambulanz in Ihrer
              Nähe (Übersichten führen z. B. die Landesärztekammern), oder bei
              Verdacht auf ME/CFS eine auf diese Erkrankung spezialisierte
              Ambulanz. Dieser Chat speichert nichts — Sie können jederzeit
              zurückkehren, sobald eine Diagnose vorliegt.
            </p>
          </div>
        )}

        {phase === "chat" && (
          <>
            <div style={styles.progressLine}>
              {turnCount === 0
                ? "Beginn des Gesprächs"
                : `Frage/Antwort ${turnCount} · Budget ca. 6-8 Austausche`}
            </div>
            <div style={styles.chatWindow} ref={scrollRef}>
              {messages.map((m, i) => {
                if (m.role === "user") {
                  return (
                    <div key={i} style={styles.userBubble}>
                      {m.content}
                    </div>
                  );
                }
                const { body, refs } = splitReferences(m.content);
                const isOpen = !!openRefs[i];
                return (
                  <div key={i} style={styles.assistantBubble}>
                    {body}
                    {refs && (
                      <div style={styles.refsArea}>
                        <button
                          style={styles.refsButton}
                          onClick={() => setOpenRefs((o) => ({ ...o, [i]: !o[i] }))}
                        >
                          {isOpen ? "Referenzen ausblenden" : `Referenzen anzeigen (${refs.length})`}
                        </button>
                        <button style={styles.refsButton} onClick={() => copyText(m.content, i)}>
                          {copiedIndex === i ? "Kopiert ✓" : "Auswertung kopieren"}
                        </button>
                        {isOpen && (
                          <ul style={styles.refsList}>
                            {refs.map((r, j) => (
                              <li key={j} style={styles.refsListItem}>
                                {r}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {refs &&
                      isMdeEinschlaegig(body) &&
                      (mentionsNonHealthSector(fullTranscriptText()) ? (
                        <p style={styles.letterOtherSectorNotice}>{OTHER_SECTOR_NOTICE}</p>
                      ) : (
                        <div style={styles.letterArea}>
                          {!letterOpen[i] && (
                            <button
                              style={styles.refsButton}
                              onClick={() => setLetterOpen((o) => ({ ...o, [i]: true }))}
                            >
                              Brief an die Berufsgenossenschaft erstellen
                            </button>
                          )}
                          {letterOpen[i] && (
                            <div style={styles.letterForm}>
                              <label style={styles.letterLabel}>
                                Name
                                <input
                                  style={styles.letterInput}
                                  value={getLetterFields(i).name}
                                  onChange={(e) => updateLetterField(i, { name: e.target.value })}
                                  placeholder="Vor- und Nachname"
                                />
                              </label>
                              <label style={styles.letterLabel}>
                                Adresse
                                <textarea
                                  style={styles.letterTextarea}
                                  rows={2}
                                  value={getLetterFields(i).address}
                                  onChange={(e) => updateLetterField(i, { address: e.target.value })}
                                  placeholder={"Straße Hausnr.\nPLZ Ort"}
                                />
                              </label>
                              <label style={styles.letterLabel}>
                                Datum
                                <input
                                  style={styles.letterInput}
                                  value={getLetterFields(i).date}
                                  onChange={(e) => updateLetterField(i, { date: e.target.value })}
                                  placeholder="TT.MM.JJJJ"
                                />
                              </label>
                              <p style={styles.letterPrivacyNote}>
                                Diese Angaben bleiben ausschließlich in Ihrem Browser — sie werden nie
                                an den Server gesendet oder gespeichert.
                              </p>
                              <button
                                style={styles.primaryButton}
                                onClick={() => handleGenerateLetter(i, body)}
                                disabled={!getLetterFields(i).name.trim() || !getLetterFields(i).address.trim()}
                              >
                                Brief erstellen
                              </button>
                            </div>
                          )}
                          {generatedLetter[i] && (
                            <>
                              <pre style={styles.letterBox}>{generatedLetter[i]}</pre>
                              <button style={styles.refsButton} onClick={() => copyLetter(i, generatedLetter[i])}>
                                {letterCopiedIndex === i ? "Kopiert ✓" : "Brief kopieren"}
                              </button>
                              <p style={styles.letterHint}>{LETTER_SEND_HINT}</p>
                            </>
                          )}
                        </div>
                      ))}
                  </div>
                );
              })}
              {loading && (
                <div style={styles.assistantBubble}>
                  <span style={{ opacity: 0.6 }}>…</span>
                </div>
              )}
              {error && (
                <div style={styles.errorBox}>
                  {error}
                  <div style={{ marginTop: 8 }}>
                    <button
                      style={styles.secondaryButton}
                      onClick={() => lastHistory && callChatApi(lastHistory)}
                      disabled={loading || !lastHistory}
                    >
                      Erneut versuchen
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={styles.inputRow}>
              <textarea
                style={styles.textarea}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ihre Antwort — Stichworte reichen"
                rows={5}
              />
              <button
                style={styles.sendButton}
                onClick={handleSend}
                disabled={loading || !input.trim()}
              >
                Senden
              </button>
            </div>
            <div style={styles.footerRow}>
              <button style={styles.linkButton} onClick={forceEvaluation} disabled={loading}>
                Auswertung jetzt erstellen
              </button>
              <button
                style={styles.linkButton}
                onClick={() => copyText(fullTranscriptText(), "all")}
                disabled={messages.length === 0}
              >
                {copiedAll ? "Gesamter Chat kopiert ✓" : "Gesamten Chat kopieren"}
              </button>
              <span style={styles.crisisNote}>{CRISIS_NOTE}</span>
            </div>
          </>
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
  progressLine: { fontSize: 13.5, color: "var(--text-faint)", marginBottom: 10, letterSpacing: 0.1 },
  chatWindow: {
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: 16,
    height: 340,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    background: "rgba(255,255,255,.04)",
    border: "1px solid var(--border)",
    borderRadius: "5px 16px 16px 16px",
    padding: "10px 14px",
    fontSize: 16,
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
    color: "var(--text)",
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
    color: "var(--dark2)",
    borderRadius: "16px 5px 16px 16px",
    padding: "10px 14px",
    fontSize: 16,
    fontWeight: 600,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  errorBox: {
    background: "rgba(248,113,113,.08)",
    border: "1px solid rgba(248,113,113,.35)",
    color: "var(--danger)",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 15,
  },
  refsArea: { marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 },
  refsButton: {
    background: "var(--gold-dim)",
    border: "1px solid var(--border-gold)",
    color: "var(--gold-light)",
    borderRadius: 999,
    padding: "6px 12px",
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  refsList: { marginTop: 8, paddingLeft: 18, fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)", width: "100%" },
  refsListItem: { marginBottom: 4 },
  letterArea: { marginTop: 10, width: "100%" },
  letterOtherSectorNotice: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 1.55,
    color: "var(--gold-light)",
    background: "var(--gold-dim)",
    border: "1px solid var(--border-gold)",
    borderRadius: 10,
    padding: "8px 10px",
  },
  letterForm: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "rgba(255,255,255,.03)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 12,
  },
  letterLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--text)",
  },
  letterInput: {
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "inherit",
    fontWeight: 400,
    color: "var(--text)",
  },
  letterTextarea: {
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "inherit",
    fontWeight: 400,
    resize: "vertical",
    color: "var(--text)",
  },
  letterPrivacyNote: { fontSize: 11.5, color: "var(--text-faint)", margin: 0, lineHeight: 1.5 },
  letterBox: {
    marginTop: 10,
    background: "rgba(255,255,255,.03)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 12,
    fontSize: 13.5,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    fontFamily: "inherit",
    color: "var(--text)",
  },
  letterHint: {
    marginTop: 8,
    fontSize: 12,
    color: "var(--text-faint)",
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  },
  inputRow: { display: "flex", flexDirection: "column", gap: 10, marginTop: 12 },
  textarea: {
    width: "100%",
    resize: "vertical",
    minHeight: 155,
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "14px 16px",
    fontSize: 16,
    fontFamily: "inherit",
    lineHeight: 1.5,
    color: "var(--text)",
  },
  sendButton: {
    alignSelf: "flex-end",
    background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
    color: "var(--dark2)",
    border: "none",
    borderRadius: 999,
    padding: "13px 32px",
    fontSize: 15.5,
    fontWeight: 700,
    cursor: "pointer",
  },
  footerRow: { marginTop: 14, display: "flex", flexDirection: "column", gap: 8 },
  linkButton: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    color: "var(--gold-light)",
    fontSize: 14.5,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
  crisisNote: { fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.5 },
};
