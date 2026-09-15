"use client";

import { useEffect, useRef, useState } from "react";
import { splitReferences, extractAuswahlPrompt } from "@/lib/format";
import { splitStreamError } from "@/lib/streamProtocol";
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
import TriageFlow from "./TriageFlow";
import type { Answers } from "@/lib/triage/types";
import { answersToContextText, triageResultToPromptAnchor } from "@/lib/triage/context";
import { computeTriage } from "@/lib/triage/scoring";

const STORAGE_NOTICE =
  "Ihre Angaben werden zur Erstellung der Einschätzung an unseren KI-Anbieter (Anthropic) zur Verarbeitung übermittelt. Auf unseren eigenen Servern speichern wir sie nicht darüber hinaus — mit Schließen dieses Fensters sind Ihre Angaben bei uns unwiderruflich weg, planen Sie die gut 15 Minuten möglichst am Stück ein.";

type Role = "user" | "assistant";
interface Message {
  role: Role;
  content: string;
}
type Phase = "landing" | "gate" | "warned" | "triage" | "triageResult" | "chat" | "ended";

function useAutoScroll(dep: number) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [dep]);
  return ref;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [diagnosisConfirmed, setDiagnosisConfirmed] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnCount, setTurnCount] = useState(0);
  const [lastHistory, setLastHistory] = useState<Message[] | null>(null);
  const [triageContext, setTriageContext] = useState<string | null>(null);
  const [triageAnchor, setTriageAnchor] = useState<string | null>(null);
  const [beruflicherKontextNein, setBeruflicherKontextNein] = useState(false);
  const [openRefs, setOpenRefs] = useState<Record<number, boolean>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | "all" | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [letterOpen, setLetterOpen] = useState<Record<number, boolean>>({});
  const [letterFields, setLetterFields] = useState<Record<number, LetterFields>>({});
  const [generatedLetter, setGeneratedLetter] = useState<Record<number, string>>({});
  const [letterCopiedIndex, setLetterCopiedIndex] = useState<number | null>(null);
  // Auswahl-Checkpoint nach der Detailanalyse (siehe AUSWAHL-CHECKPOINT in
  // lib/chat.ts): extraTurnCount ist null, solange keine Vertiefungsrunde
  // aktiv ist (unverändertes Verhalten) - erst mit "weitere Fragen" gesetzt.
  const [extraQuestionsMode, setExtraQuestionsMode] = useState(false);
  const [extraTurnCount, setExtraTurnCount] = useState(0);
  // "Fragen zum BG-Verfahren?" - eigener Mini-Chat pro Auswertungsnachricht
  // (Index i), analog zum letterOpen/generatedLetter-Muster oben.
  const [bgHelpOpen, setBgHelpOpen] = useState<Record<number, boolean>>({});
  const [bgHelpMessages, setBgHelpMessages] = useState<Record<number, Message[]>>({});
  const [bgHelpInput, setBgHelpInput] = useState<Record<number, string>>({});
  const [bgHelpLoading, setBgHelpLoading] = useState<Record<number, boolean>>({});
  const [bgHelpError, setBgHelpError] = useState<Record<number, string | null>>({});

  const BG_HELP_GREETING =
    "BG-Verfahren können bürokratisch und aufwändig sein. Fragen Sie mich einfach, was Sie wissen möchten, und ich versuche Ihnen eine möglichst präzise Antwort zu geben.";

  function openBgHelp(i: number, evaluationBody: string) {
    setBgHelpOpen((o) => ({ ...o, [i]: true }));
    if (!bgHelpMessages[i]) {
      setBgHelpMessages((m) => ({
        ...m,
        [i]: [{ role: "assistant", content: BG_HELP_GREETING }],
      }));
    }
    // evaluationBody wird erst beim ersten tatsächlichen Senden gebraucht
    // (siehe sendBgHelpMessage) - hier nur das Panel öffnen und begrüßen,
    // kein API-Call.
    void evaluationBody;
  }

  async function sendBgHelpMessage(i: number, evaluationBody: string) {
    const text = (bgHelpInput[i] ?? "").trim();
    if (!text || bgHelpLoading[i]) return;
    const history = bgHelpMessages[i] ?? [{ role: "assistant", content: BG_HELP_GREETING }];
    const next: Message[] = [...history, { role: "user", content: text }];
    setBgHelpMessages((m) => ({ ...m, [i]: next }));
    setBgHelpInput((inp) => ({ ...inp, [i]: "" }));
    setBgHelpError((e) => ({ ...e, [i]: null }));
    setBgHelpLoading((l) => ({ ...l, [i]: true }));

    // Die lokal erzeugte Begrüßungsnachricht (oben) kam nie vom Modell und
    // darf wie bei der Tier-1-Kurzauswertung im Hauptchat nicht als erste
    // Nachricht an die API gehen (die verlangt zwingend role "user" zuerst) -
    // gleiche Begründung wie in callChatApi() oben.
    const firstUserIdx = next.findIndex((m) => m.role === "user");
    const apiMessages = firstUserIdx === -1 ? [] : next.slice(firstUserIdx);
    const assistantIndex = next.length;

    try {
      const response = await fetch("/api/bg-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, evaluationContext: evaluationBody }),
      });

      if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
          const data: { error?: string } = await response.json();
          message = data.error || message;
        } catch {
          // siehe callChatApi oben - Plattform-Fehlerseiten sind kein JSON
        }
        throw new Error(
          response.status === 504
            ? "Zeitüberschreitung — bitte in ein bis zwei Minuten erneut versuchen."
            : message
        );
      }
      if (!response.body) throw new Error("Der Server hat keine gültige Antwort geliefert.");

      setBgHelpMessages((m) => ({ ...m, [i]: [...next, { role: "assistant", content: "" }] }));

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const { text: chunkText } = splitStreamError(full);
        setBgHelpMessages((m) => {
          const copy = [...(m[i] ?? [])];
          copy[assistantIndex] = { role: "assistant", content: chunkText };
          return { ...m, [i]: copy };
        });
      }

      const { error: streamError } = splitStreamError(full);
      if (streamError) {
        setBgHelpMessages((m) => ({ ...m, [i]: (m[i] ?? []).slice(0, assistantIndex) }));
        throw new Error(streamError);
      }
    } catch (e) {
      setBgHelpError((err) => ({
        ...err,
        [i]: "Technisches Problem: " + (e instanceof Error ? e.message : "unbekannter Fehler"),
      }));
    } finally {
      setBgHelpLoading((l) => ({ ...l, [i]: false }));
    }
  }


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

  async function callChatApi(history: Message[], extraTurnCountOverride?: number | null) {
    setLoading(true);
    setError(null);
    // Index der neuen Assistent-Nachricht, die gleich inkrementell befüllt
    // wird - `messages`-State ist zu diesem Zeitpunkt bereits `history`
    // (siehe handleSend/forceEvaluation/beginDetailanalyse, die
    // setMessages(next) VOR callChatApi(next) aufrufen), also landet sie
    // direkt dahinter.
    const assistantIndex = history.length;
    // `history` beginnt nach Tier 1 mit lokal erzeugten assistant-Nachrichten
    // (Tier-1-Kurzauswertung, ggf. der Detailanalyse-Teaser) - die wurden nie
    // vom Modell generiert und dürfen NICHT als Konversationsverlauf an die
    // Anthropic-API gesendet werden: die API verlangt zwingend, dass die
    // erste Nachricht role "user" ist, sonst schlägt der Call fehl. Für die
    // Anzeige (messages-State, oben) bleibt der volle Verlauf inkl. dieser
    // lokalen Texte erhalten - nur der an /api/chat gesendete Ausschnitt wird
    // auf den echten, mit der ersten Nutzer-Nachricht beginnenden
    // API-Verlauf beschränkt.
    const firstUserIdx = history.findIndex((m) => m.role === "user");
    const apiMessages = firstUserIdx === -1 ? [] : history.slice(firstUserIdx);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          diagnosisConfirmed,
          turnCount,
          triageContext,
          triageAnchor,
          beruflicherKontextNein,
          extraTurnCount:
            extraTurnCountOverride !== undefined
              ? extraTurnCountOverride
              : extraQuestionsMode
                ? extraTurnCount
                : null,
        }),
      });

      if (!response.ok) {
        // Fehler VOR Stream-Start (fehlender API-Key, ungültiger Request) -
        // kommt als normales JSON zurück (siehe app/api/chat/route.ts).
        let message = `HTTP ${response.status}`;
        try {
          const data: { error?: string } = await response.json();
          message = data.error || message;
        } catch {
          // Ein Plattform-Fehler (z.B. Vercel-Timeout) liefert eine eigene,
          // nicht-JSON-Fehlerseite statt unserer eigenen Fehlerbehandlung -
          // ohne diesen Fang landet hier ein kryptischer "Unexpected token"-
          // Parse-Fehler statt einer verständlichen Meldung.
        }
        throw new Error(
          response.status === 504
            ? "Zeitüberschreitung bei der Erstellung — die Anfrage war vermutlich sehr umfangreich. Bitte in ein bis zwei Minuten erneut versuchen."
            : message
        );
      }
      if (!response.body) {
        throw new Error("Der Server hat keine gültige Antwort geliefert.");
      }

      setMessages((m) => [...m, { role: "assistant", content: "" }]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const { text } = splitStreamError(full);
        setMessages((m) => {
          const copy = [...m];
          copy[assistantIndex] = { role: "assistant", content: text };
          return copy;
        });
      }

      const { error: streamError } = splitStreamError(full);
      if (streamError) {
        // Fehler MITTEN im Stream (z.B. max_tokens-Abbruch) - Teilantwort
        // verwerfen statt sie stillschweigend als vollständig stehen zu
        // lassen (gleiches Prinzip wie die max_tokens-Absicherung in
        // lib/anthropic.ts), damit "Erneut versuchen" nicht auf eine
        // Historie mit einer kaputten Assistent-Antwort aufsetzt.
        setMessages((m) => m.slice(0, assistantIndex));
        throw new Error(streamError);
      }

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
    setPhase("triage");
  }

  /**
   * Tier 1 abgeschlossen: summaryText kommt fertig formatiert aus
   * lib/triage/summary.ts (kein API-Call). Wird als erste "Assistent"-
   * Nachricht ins bestehende Chat-Fenster gehängt, damit Referenzen-Toggle,
   * Kopieren und "Brief an die BG" unverändert weiterfunktionieren - diese
   * Nachricht unterscheidet sich für die Anzeige nicht von einer LLM-Antwort.
   */
  function handleTriageComplete(answers: Answers, summaryText: string) {
    setTriageContext(answersToContextText(answers));
    // Gleiche computeTriage()-Berechnung wie in TriageFlow (dort nur für die
    // Kurzauswertung genutzt) - hier zusätzlich als Kalibrierungsanker für
    // Tier 2 aufbereitet, siehe lib/triage/context.ts,
    // triageResultToPromptAnchor() und build/effizienz-plan.md Abschnitt 6.
    setTriageAnchor(triageResultToPromptAnchor(computeTriage(answers)));
    // Konservative Wissensbasis-Selektion (build/effizienz-plan.md
    // Abschnitt 2): nur bei eindeutigem "Nein" auf die Berufsbezug-Frage
    // steuert das die Bundle-Wahl in lib/chat.ts - "unsicher" bleibt
    // absichtlich beim vollen Bestand (siehe dortiger Kommentar).
    setBeruflicherKontextNein(answers.beruflicherKontext === "nein");
    setMessages([{ role: "assistant", content: summaryText }]);
    setPhase("triageResult");
  }

  /**
   * Übergang Tier 1 → Tier 2: ab hier laufen echte Anthropic-API-Calls.
   * Löst (wie forceEvaluation unten) direkt einen echten Call aus, statt nur
   * einen lokalen Text anzuzeigen, der eine "erste Frage" ankündigt, die nie
   * kommt (Bugfix: der Text endete zuvor auf "Erste Frage:", ohne dass
   * danach je eine gestellt wurde - erst ein Senden durch die Person hätte
   * den ersten echten Call ausgelöst).
   */
  function beginDetailanalyse() {
    setPhase("chat");
    const directive: Message = {
      role: "user",
      content:
        "[Bitte jetzt mit der Detailanalyse beginnen und die erste Vertiefungsfrage stellen — zu Medikation/Therapieansprechen, bereits durchgeführten objektiven Tests oder individuellen Besonderheiten.]",
    };
    const next = [...messages, directive];
    setMessages(next);
    callChatApi(next);
  }

  function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setTurnCount((c) => c + 1);
    if (extraQuestionsMode) setExtraTurnCount((c) => c + 1);
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

  /**
   * Antwort auf den AUSWAHL-CHECKPOINT (siehe lib/chat.ts): Person möchte
   * jetzt die Auswertung. Inhaltlich dasselbe wie forceEvaluation() (eigene
   * Funktion trotzdem, damit beide Aufrufstellen unabhängig bleiben, falls
   * sich einer der beiden Texte künftig unterscheiden soll).
   */
  function chooseAuswertung() {
    if (loading) return;
    const directive: Message = {
      role: "user",
      content: "Auswertung",
    };
    const next = [...messages, directive];
    setMessages(next);
    callChatApi(next, null);
  }

  /** Antwort auf den AUSWAHL-CHECKPOINT: Person möchte weitere Fragen -
   *  startet die auf 5 Austausche begrenzte Vertiefungsrunde (siehe
   *  ZUSÄTZLICHE VERTIEFUNGSRUNDE in lib/chat.ts). */
  function chooseWeitereFragen() {
    if (loading) return;
    setExtraQuestionsMode(true);
    setExtraTurnCount(0);
    const directive: Message = {
      role: "user",
      content: "weitere Fragen",
    };
    const next = [...messages, directive];
    setMessages(next);
    // extraQuestionsMode ist an dieser Stelle im Closure noch false (React
    // aktualisiert State asynchron) - ohne den expliziten Override würde der
    // erste Request der Vertiefungsrunde extraTurnCount:null statt 0 senden
    // und den dynamischen Budget-Hinweis für genau diese eine Nachricht
    // verlieren (die statische AUSWAHL-CHECKPOINT-Regel im Prompt greift
    // trotzdem, aber sauberer ist es so).
    callChatApi(next, 0);
  }

  return (
    <div style={styles.centerWrap}>
      <div style={styles.container}>
        {phase !== "landing" && (
          <header style={styles.header}>
            <h1 style={styles.title}>{PATIENT_TITLE}</h1>
            <p style={styles.subtitle}>{PATIENT_SUBTITLE}</p>
            <button style={styles.aboutLink} onClick={() => setAboutOpen((o) => !o)}>
              {aboutOpen ? "Über BASTET ausblenden" : "ℹ️ Über BASTET / Rechtliches"}
            </button>
            {aboutOpen && <div style={styles.aboutPanel}>{ABOUT_TEXT}</div>}
          </header>
        )}

        {phase === "landing" && (
          <div style={styles.landingWrap}>
            <div style={styles.landingLogoRow}>
              <img src="/assets/bastet-badge.png" alt="BASTET" style={styles.landingLogo} />
              <div style={styles.landingWordmark}>BASTET</div>
              <div style={styles.landingTagline}>
                Beratungsassistent zur systematischen Evaluation von Post-COVID Syndromen
              </div>
            </div>

            <div style={styles.heroCard}>
              <p style={styles.heroText}>
                Allein 2020 bis 2022 registrierte das RKI in Deutschland über 37
                Millionen labordiagnostisch bestätigte COVID-19-Infektionen
                <sup style={styles.foot}>1</sup>. Laut RKI entwickeln 10–15 % der
                Infizierten Beschwerden, die auch nach 12 Wochen anhalten
                <sup style={styles.foot}>2</sup> — insgesamt geht man von über 1,4
                Millionen Menschen mit Long-COVID oder ME/CFS in Deutschland aus
                <sup style={styles.foot}>3</sup>.
              </p>
              <p style={styles.heroText}>
                Allein seit 2021 wurden über 450.000 Verdachtsfälle auf eine
                berufsbedingte COVID-19-Erkrankung bei den Berufsgenossenschaften
                angezeigt<sup style={styles.foot}>4</sup>, rund 75 % davon bei der
                BGW<sup style={styles.foot}>5</sup>. Allein in den ersten beiden
                Pandemiejahren 2020 und 2021 wurden bereits über 120.000 Fälle als
                Berufskrankheit (BK 3101) anerkannt<sup style={styles.foot}>6</sup> —
                das deutet auf eine fünfstellige Zahl an Menschen mit beruflich
                bedingtem Post-COVID-Syndrom bzw. ME/CFS hin, die im Alltag und
                Erwerbsleben spürbar eingeschränkt sind.
              </p>
              <p style={{ ...styles.heroText, marginBottom: 0 }}>
                Demgegenüber stehen allein 2024 rund 536 neu bewilligte
                BK-3101-Renten (2025: 603, weiter steigend)
                <sup style={styles.foot}>4</sup> — die BGW selbst weist auf eine
                begrenzte Zahl unabhängiger, fachlich versierter Gutachter:innen
                hin<sup style={styles.foot}>7</sup>. Bei der Rentenversicherung
                (Erwerbsminderung) und den Versorgungsämtern (GdB) zeigt sich ein
                ähnliches Bild.
              </p>
            </div>
            <p style={styles.citeBlock}>
              1 Robert Koch-Institut: FAQ zur COVID-19-Pandemie, rki.de (Stand der
              zitierten Zahl: 2020–2022). — 2 Robert Koch-Institut: &bdquo;Long
              COVID bei Erwachsenen&ldquo;, Journal of Health Monitoring
              2026;11:02. — 3 ME/CFS Research Foundation &amp; Risklayer:
              &bdquo;The rising cost of Long COVID and ME/CFS in Germany&ldquo;,
              Kostenbericht Mai 2025 (Update April 2026). — 4 BGW: Jahresbericht
              2025, Tabellenanhang &bdquo;Auf einen Blick&ldquo;, bgw-online.de. —
              5 DGUV forum: &bdquo;COVID-19-Erkrankungen als Versicherungsfälle der
              BGW&ldquo; (DGUV Referat Statistik), Ausgabe 1/2024, forum.dguv.de. —
              6 DGUV forum: &bdquo;COVID-19 als Berufskrankheit in den
              Berichtsjahren 2020 und 2021&ldquo; (DGUV Referat Statistik),
              Ausgabe 9/2022, forum.dguv.de. — 7 BGW: &bdquo;5 Jahre
              Covid-19-Pandemie: Rückblick, Situation, Ausblick&ldquo;,
              bgw-online.de.
            </p>

            <div style={styles.heroCard}>
              <p style={styles.heroText}>
                Hier setzt BASTET an: ein KI-gestütztes, quellenbasiertes
                Hilfsmittel für Betroffene und Entscheidungsträger:innen
                gleichermaßen — um Post-COVID-/ME-CFS-Symptome zu erkennen,
                einzuordnen und nach den Maßstäben der gesetzlichen
                Unfallversicherung mit bestehenden MdE- und GdB-Entscheidungen
                abzugleichen.
              </p>
              <p style={{ ...styles.heroSubText, marginBottom: 0 }}>
                Der Name steht für „Beratungsassistent zur systematischen
                Evaluation von Post-COVID Syndromen" — benannt
                nach der altägyptischen Katzengöttin Bastet, Beschützerin von
                Frauen, Kindern und Familie vor Krankheit und Unheil. Unter den
                beruflich anerkannten Fällen sind rund 80 % der Betroffenen
                Frauen<sup style={styles.foot}>8</sup>, da beruflich bedingte
                Infektionen überproportional Beschäftigte in Pflege- und
                Care-Berufen treffen.
              </p>
            </div>
            <p style={styles.citeBlock}>
              8 DGUV forum: &bdquo;COVID-19 als Berufskrankheit – Update
              2022&ldquo;, Ausgabe 9/2023, forum.dguv.de.
            </p>

            <div style={styles.heroCard}>
              <p style={styles.heroText}>
                BASTET besteht aus zwei Teilen: einem einfachen Fragenkatalog zum
                Anklicken und einem kurzen Dialog mit der BASTET-KI in eigenen
                Worten. Stichpunkte reichen — je mehr Sie schildern, desto
                genauer die Einschätzung.
              </p>
              <p style={{ ...styles.warningText, marginBottom: 0 }}>
                BASTET speichert Ihren Gesprächsverlauf nicht. Einmal geschlossen
                oder neu gestartet, ist er unwiderruflich weg.
              </p>
            </div>

            <div style={styles.landingButtonCol}>
              <button style={styles.landingPrimaryButton} onClick={() => setPhase("gate")}>
                Starte BASTET
              </button>
              <button style={styles.landingSecondaryButton} onClick={() => setAboutOpen((o) => !o)}>
                {aboutOpen ? "Infos ausblenden" : "Mehr Infos zu BASTET"}
              </button>
            </div>
            {aboutOpen && <div style={styles.aboutPanel}>{ABOUT_TEXT}</div>}
          </div>
        )}

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

        {phase === "triage" && <TriageFlow onComplete={handleTriageComplete} />}

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

        {(phase === "chat" || phase === "triageResult") && (
          <>
            <div style={styles.progressLine}>
              {phase === "triageResult"
                ? "Ersteinschätzung abgeschlossen"
                : turnCount === 0
                ? "Detailanalyse — Ergänzungen willkommen"
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
                const isStreamingPlaceholder = loading && i === messages.length - 1 && m.content === "";
                const { body, refs } = splitReferences(m.content);
                const auswahl = extractAuswahlPrompt(body);
                const displayBody = auswahl.isAuswahlPrompt ? auswahl.body : body;
                const isOpen = !!openRefs[i];
                const isLastMessage = i === messages.length - 1;
                return (
                  <div key={i} style={styles.assistantBubble}>
                    {isStreamingPlaceholder ? <span style={{ opacity: 0.6 }}>…</span> : displayBody}
                    {auswahl.isAuswahlPrompt && isLastMessage && !loading && (
                      <div style={styles.buttonRow}>
                        <button style={styles.primaryButton} onClick={chooseAuswertung}>
                          Auswertung
                        </button>
                        <button style={styles.secondaryButton} onClick={chooseWeitereFragen}>
                          weitere Fragen
                        </button>
                      </div>
                    )}
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
                                style={styles.footerPrimaryButton}
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
                    {refs && isMdeEinschlaegig(body) && (
                      <div style={styles.bgHelpArea}>
                        {!bgHelpOpen[i] && (
                          <button style={styles.refsButton} onClick={() => openBgHelp(i, body)}>
                            Fragen zum BG-Verfahren?
                          </button>
                        )}
                        {bgHelpOpen[i] && (
                          <div style={styles.bgHelpPanel}>
                            {(bgHelpMessages[i] ?? []).map((bm, j) => (
                              <div
                                key={j}
                                style={bm.role === "user" ? styles.bgHelpUserBubble : styles.bgHelpAssistantBubble}
                              >
                                {bm.content === "" && bgHelpLoading[i] && j === (bgHelpMessages[i]?.length ?? 0) - 1 ? (
                                  <span style={{ opacity: 0.6 }}>…</span>
                                ) : (
                                  bm.content
                                )}
                              </div>
                            ))}
                            {bgHelpError[i] && <div style={styles.errorBox}>{bgHelpError[i]}</div>}
                            <div style={styles.bgHelpInputRow}>
                              <input
                                style={styles.bgHelpInput}
                                value={bgHelpInput[i] ?? ""}
                                onChange={(e) => setBgHelpInput((inp) => ({ ...inp, [i]: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    sendBgHelpMessage(i, body);
                                  }
                                }}
                                placeholder="Ihre Frage zum BG-Verfahren…"
                                disabled={!!bgHelpLoading[i]}
                              />
                              <button
                                style={styles.footerPrimaryButton}
                                onClick={() => sendBgHelpMessage(i, body)}
                                disabled={!!bgHelpLoading[i] || !(bgHelpInput[i] ?? "").trim()}
                              >
                                Senden
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Deckt nur die kurze Lücke ab, bevor die (leere) Assistent-
                  Platzhalter-Nachricht selbst im Zustand ist (siehe
                  isStreamingPlaceholder oben) - z.B. Netzwerk-Latenz bis zu
                  den Response-Headern, noch bevor der erste Stream-Chunk
                  ankommt. */}
              {loading && messages[messages.length - 1]?.role === "user" && (
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

            {phase === "triageResult" && (
              <div style={styles.footerRow}>
                <button style={styles.footerPrimaryButton} onClick={beginDetailanalyse}>
                  Detailanalyse anfordern (Beta)
                </button>
                <button
                  style={styles.linkButton}
                  onClick={() => copyText(fullTranscriptText(), "all")}
                >
                  {copiedAll ? "Kurzauswertung kopiert ✓" : "Kurzauswertung kopieren"}
                </button>
                <span style={styles.crisisNote}>{CRISIS_NOTE}</span>
              </div>
            )}

            {phase === "chat" && (
              <>
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
  landingWrap: { display: "flex", flexDirection: "column" },
  landingLogoRow: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    marginBottom: 22,
  },
  landingLogo: {
    width: 120,
    height: 120,
    borderRadius: 20,
    border: "1px solid var(--border-gold)",
    boxShadow: "0 8px 28px rgba(0,0,0,.5)",
    display: "block",
    marginBottom: 10,
  },
  landingWordmark: {
    fontFamily: "Cambria, Georgia, serif",
    fontWeight: 700,
    fontSize: 30,
    letterSpacing: "2px",
    color: "var(--gold)",
    textShadow: "0 0 24px rgba(201,168,76,.3)",
  },
  landingTagline: { fontSize: 13, color: "var(--text-muted)", marginTop: 4 },
  heroCard: {
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border-gold)",
    borderRadius: 16,
    padding: "18px 16px",
    marginBottom: 6,
  },
  heroText: { fontSize: 14.5, lineHeight: 1.65, color: "var(--text)", margin: "0 0 10px" },
  heroSubText: { fontSize: 13, lineHeight: 1.6, color: "var(--text-muted)", margin: 0 },
  foot: { color: "var(--gold)" },
  citeBlock: {
    fontSize: 10.5,
    lineHeight: 1.55,
    color: "var(--text-faint)",
    margin: "0 0 14px",
    padding: "0 4px",
  },
  landingButtonCol: { display: "flex", flexDirection: "column", gap: 10, marginTop: 18 },
  // Eigene Varianten statt primaryButton/secondaryButton direkt zu nutzen:
  // deren flex: "1 1 200px" ist für eine Zeile (buttonRow) gedacht - in
  // einer Spalte (landingButtonCol, flexDirection: column) wird die 200px-
  // Flex-Basis stattdessen als HÖHE interpretiert und bläht den Button auf
  // (derselbe Bug, den footerPrimaryButton weiter unten schon einmal für
  // footerRow behoben hat). width: "100%" statt Flex-Basis vermeidet das.
  landingPrimaryButton: {
    width: "100%",
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
  landingSecondaryButton: {
    width: "100%",
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
  // Gleiche Optik wie primaryButton, aber ohne dessen flex: "1 1 200px" —
  // das ist für buttonRow gedacht (display:flex, Reihe). In footerRow
  // (flexDirection: column) wird die 200px-Flex-Basis stattdessen als HÖHE
  // interpretiert und flex-grow:1 lässt den Button über die volle Höhe/
  // Breite des Footers aufblähen. alignSelf: "flex-start" hält ihn auf
  // Inhaltsgröße, wie linkButton direkt darunter.
  footerPrimaryButton: {
    alignSelf: "flex-start",
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
  bgHelpArea: { marginTop: 10, width: "100%" },
  bgHelpPanel: {
    marginTop: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    background: "rgba(255,255,255,.03)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: 12,
  },
  bgHelpAssistantBubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    background: "rgba(255,255,255,.04)",
    border: "1px solid var(--border)",
    borderRadius: "5px 12px 12px 12px",
    padding: "8px 11px",
    fontSize: 14.5,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    color: "var(--text)",
  },
  bgHelpUserBubble: {
    alignSelf: "flex-end",
    maxWidth: "92%",
    background: "linear-gradient(135deg, var(--gold), var(--gold-light))",
    color: "var(--dark2)",
    borderRadius: "12px 5px 12px 12px",
    padding: "8px 11px",
    fontSize: 14.5,
    fontWeight: 600,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  bgHelpInputRow: { display: "flex", gap: 8, marginTop: 4 },
  bgHelpInput: {
    flex: 1,
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 10px",
    fontSize: 14,
    fontFamily: "inherit",
    fontWeight: 400,
    color: "var(--text)",
  },
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
