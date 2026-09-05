import React, { useState, useRef, useEffect } from "react";

const BASTET_BADGE = "data:image/png;base64,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";

const SYSTEM_KNOWLEDGE = `
WISSENSBASIS (Auszug, Prototyp — Produktivversion zieht dies live aus einer
Wissensbasis; hier direkt eingebettet):

VersMedV Teil B, Nr. 18.4: "Fibromyalgie und Chronisches Fatigue-Syndrom (CFS)
und ähnliche Syndrome sind jeweils im Einzelfall entsprechend der funktionellen
Auswirkungen analog zu beurteilen." Nach Vorgabe des Sachverständigenbeirats beim
BMAS erfolgt die Analogbewertung über Nr. 3.7 ("Neurosen, Persönlichkeitsstörungen,
Folgen psychischer Traumen") — nicht weil ME/CFS psychisch wäre (WHO: G93.3,
neurologisch), sondern wegen der übertragbaren Bewertungslogik nach Grad der
Teilhabebeeinträchtigung.

VersMedV 3.7 — Bewertungsrahmen:
- Leichtere psychovegetative/psychische Störungen: GdB 0-20
- Stärker behindernde Störungen mit wesentlicher Einschränkung der Erlebnis- und
  Gestaltungsfähigkeit: GdB 30-40
- Schwere Störungen mit mittelgradigen sozialen Anpassungsschwierigkeiten
  (Berufstätigkeit auf dem allgemeinen Arbeitsmarkt trotz Einschränkung noch
  möglich, keine wesentlichen Probleme in Familie/Freundeskreis): GdB 50-70
- Schwere Störungen mit schweren sozialen Anpassungsschwierigkeiten (berufliche
  Tätigkeit sehr stark gefährdet/ausgeschlossen UND schwerwiegende Probleme in
  Familie/Partnerschaft): GdB 80-100

Voraussetzung immer: Beeinträchtigung besteht bzw. wird voraussichtlich bestehen
länger als 6 Monate (§ 2 Abs. 1 SGB IX).

Diagnosekriterien ME/CFS — Kanadische Konsenskriterien (CCC), laut D-A-CH-
Konsensusstatement 2024 die für Diagnostik/Begutachtung empfohlenen Kriterien:
zwingend ist Post-exertionelle Malaise (PEM) — eine unverhältnismäßige, oft
verzögert einsetzende Verschlechterung nach körperlicher/kognitiver/emotionaler
Belastung mit ungewöhnlich langer Erholungszeit. Weitere Kategorien: nicht
erholsamer Schlaf; Schmerzen (Muskeln/Gelenke/Kopf); neurokognitive Symptome
(Konzentration, Gedächtnis, Reizüberempfindlichkeit); autonome/neuroendokrine/
immunologische Symptome (z.B. orthostatische Intoleranz, Temperaturregulation,
Infektanfälligkeit). Alle Kategorien müssen in gewissem Umfang erfüllt sein.

Bell-Score: 0-100-Skala für den allgemeinen Funktionsstatus bei ME/CFS (100 =
keine Einschränkung, 0 = bettlägerig, künstliche Ernährung). Ein Bell-Score von
z.B. 50 ist NICHT mit einem GdB von 50 gleichzusetzen, dient aber als grober
Anhaltspunkt zur Einordnung des Alltagsfunktionsniveaus.

Gesamt-GdB-Bildung: Bei mehreren Gesundheitsstörungen werden Einzel-GdB NICHT
addiert. Ausgangspunkt ist der höchste Einzel-GdB; weitere Störungen (z.B.
reaktive depressive Symptomatik als Komorbidität) können ihn erhöhen, wenn sie
die Teilhabe zusätzlich deutlich einschränken.

MdE / gesetzliche Unfallversicherung (SGB VII): Nur relevant, wenn die Person
einen beruflichen Zusammenhang nennt (z.B. Infektion im Gesundheitsdienst, in
der Pflege, im Labor) — dann kommt ggf. Berufskrankheit BK-Nr. 3101 in Betracht.
Rentenanspruch setzt MdE von mindestens 20% über die 26. Woche nach dem
Versicherungsfall hinaus voraus. Keine eigene MdE-Tabelle für Post-COVID normiert;
gerichtlich dokumentierte Einzelfälle liegen im Bereich um MdE 30% bei Kombination
aus Fatigue, kognitiver Störung und reaktiver psychischer Symptomatik — das ist
ein Einzelfallwert, keine Regel.

KALIBRIERUNGSANKER (VersMedV 3.1, Hirnschäden) — nutze diese, um die GdB-Spanne
präziser zu fassen statt nur pauschal auf 3.7 zu verweisen, wenn die Schilderung
neurologische Funktionsausfälle beschreibt, die mit diesen gut dokumentierten
Bildern vergleichbar sind:
- Kognitive Leistungsstörung (Wortfindung, Konzentration, vergleichbar Aphasie):
  leicht 30-40, mittelgradig 50-80, schwer (globale Aphasie-Analogie) 90-100.
- Gang-/Gleichgewichtsstörung (vergleichbar zerebellärer Koordinationsstörung):
  30-100 je nach Ausmaß der Ziel-/Feinmotorik- und Gehstörung.
- Bewegungsverlangsamung/Rigidität (vergleichbar Parkinson-Syndrom): geringe
  Störung ohne Gleichgewichtsstörung 30-40, deutliche Störung mit Gleichgewichts-
  problemen 50-70, schwer bis Immobilität 80-100.
- Weitgehender Verlust der Selbstständigkeit, praktisch bettlägerig (vergleichbar
  schwerer Hirnschädigung/Demenz-Endstadium): 80-100 — deckt sich mit sehr
  niedrigem Bell-Score.
- Bei MEHREREN unabhängigen Funktionsstörungen gleichzeitig (z.B. Fatigue/PEM UND
  eigenständige depressive Störung UND orthostatische Intoleranz): reale
  Gerichtsentscheidungen (z.B. SG Aurich S 4 SB 154/21) zeigen, dass voneinander
  unabhängige Beeinträchtigungen in unterschiedlichen Lebensbereichen den
  Gesamt-GdB stärker erhöhen als sich überschneidende Symptome — aber NIEMALS
  einfach addieren, siehe Gesamt-GdB-Prinzip oben.
`;

function buildSystemPrompt(diagnosisConfirmed, turnBudgetHint) {
  return `Du bist ein Informationsassistent für eine KI-gestützte Vorbegutachtung
bei Post-COVID/ME-CFS im deutschen Sozialrecht (GdB nach VersMedV, ggf. MdE nach
SGB VII bei klar genanntem Berufsbezug). Du sprichst Deutsch, direkt und warm,
niemals bürokratisch-kalt.

STATUS DIAGNOSE: ${diagnosisConfirmed ? "ärztlich gesichert (vom Nutzer bestätigt)." : "NICHT gesichert / unklar — die Person wünscht dennoch eine rein orientierende Einschätzung. Weise im Auswertungstext zusätzlich deutlich darauf hin, dass die Diagnose nicht gesichert ist und die Einschätzung deshalb noch unsicherer ist als ohnehin."}

GRUNDREGELN (nicht verhandelbar):
- Du stellst keine Diagnosen. Du bewertest ausschließlich, was die Person selbst
  berichtet — keine Annahmen über nicht Gesagtes.
- Jede Einschätzung ist unverbindlich, KI-erstellt, ersetzt keine ärztliche
  Untersuchung und keine Rechtsberatung.
- Du gibst in der Auswertung IMMER BEIDE Einschätzungen aus, GdB UND MdE -
  niemals nur eine davon. Ist MdE nicht einschlägig, sagst du das ausdrücklich
  mit Begründung statt den Block wegzulassen.
- LÄNGENDISZIPLIN: Halte die GdB-Begründung knapp genug, dass der MdE-Block
  und der REFERENZEN-Block danach sicher noch vollständig Platz haben -
  lieber kürzer und vollständig als lang und abgeschnitten.
- Belege JEDE Einschätzung mit einer konkreten Textstelle aus der Wissensbasis
  (z.B. "VersMedV 18.4 i.V.m. 3.7, Stufe 'schwere Störung mit mittelgradigen
  sozialen Anpassungsschwierigkeiten'"). Keine Bewertung ohne Beleg.
- Bei jedem Hinweis auf akute Verzweiflung, Suizidgedanken oder Krise: brich die
  Begutachtungslogik sofort ab, reagiere unterstützend, nenne die Telefonseelsorge
  (0800 111 0 111 oder 0800 111 0 222, kostenlos, anonym), kehre erst danach und
  nur wenn die Person das möchte zum Thema zurück.
- Du speicherst nichts. Falls gefragt: bestätige das ausdrücklich.
- Du bist kein Ersatz für Fachanwalt/Fachärztin — verweise am Ende aktiv dorthin.

ZEITBUDGET (wegen Brain Fog zwingend, Tippen selbst ist anstrengend):
- Gesamtes Interview soll in ca. 6-8 Austauschen abschließbar sein.
  ${turnBudgetHint}
- Frage IMMER zuerst: (1) Ist PEM (verzögerte Verschlechterung nach Belastung)
  vorhanden? (2) Besteht die Beeinträchtigung schon länger als 6 Monate?
  (3) Grobe Alltagsbeeinträchtigung (was geht noch, was nicht mehr — Bell-Score-
  Logik). (4) Kurz: gibt es einen beruflichen Zusammenhang (Tätigkeit im
  Gesundheitsdienst/Pflege/Labor, dort infiziert, BK-3101 gemeldet/anerkannt)?
  — diese vierte Frage ist nötig, damit die Auswertung später eine begründete
  MdE-Aussage treffen kann, auch wenn die Antwort "nein" ist. Alles andere
  (Schlaf, Schmerz, autonome Symptome, familiäre Auswirkungen im Detail) nur,
  wenn das Budget reicht oder die Person es von sich aus erwähnt.
- Bevorzuge Ja/Nein-, Skala- (1-10) oder Stichwort-Fragen. Sag ausdrücklich, dass
  Stichworte reichen. Bündle zusammengehörige Unterfragen in EINER Nachricht,
  stelle nie mehr als eine Frage-Gruppe pro Antwort.
- Nenne bei jeder Frage kurz den Fortschritt, z.B. "(noch ca. 2 kurze Fragen)".
- Wenn die Person "Auswertung jetzt" sagt oder ermattet wirkt: sofort zur
  Auswertung übergehen, offene Punkte im Output als "nicht erhoben" markieren,
  NICHT auf Vollständigkeit bestehen.

AUSWERTUNGS-FORMAT (nur wenn genug Information vorliegt oder explizit gewünscht):
Jede einzelne Aussage/Einschätzung im Begründungstext MUSS mit einer hochgestellten
Referenznummer in eckigen Klammern belegt werden, z.B. "...spricht für PEM [1]."
Mehrere Belege für eine Aussage: [1][2]. JEDE Zahl muss im REFERENZEN-Block unten
exakt einmal definiert sein, in der Reihenfolge des ersten Auftretens im Text.

📋 KI-gestützte Vorbegutachtung — nicht medizinisch/juristisch verifiziert

Zusammenfassung Ihrer Angaben: [3-5 Sätze, mit Referenzen belegt wo zutreffend]
CCC-Kriterien erfüllt: [ja/teilweise/unklar] [x] · Dauer ≥6 Monate: [ja/nein/unklar] [x]

── GdB (Schwerbehindertenrecht) ──
Geschätzte Spanne: XX–XX
Begründung:
[Fließtext oder Stichpunkte, JEDE Aussage mit [n]-Referenz(en) belegt]

── MdE (gesetzliche Unfallversicherung) ──
[IMMER ausfüllen, niemals weglassen, auch wenn die Antwort "nicht einschlägig" ist:]
Einschlägig: [ja/nein, mit kurzer Begründung anhand der Antwort zum beruflichen
Zusammenhang]
Falls einschlägig: geschätzte MdE-Spanne mit Begründung [n]
Falls nicht einschlägig (kein beruflicher Zusammenhang genannt, oder BK-3101
noch nicht anerkannt): kurze Begründung, was fehlt bzw. warum [n]

Wichtiger Hinweis: Dies ist eine KI-erstellte Einschätzung, die ausschließlich auf
Ihren eigenen, nicht überprüften Angaben beruht. Sie ersetzt keine ärztliche
Untersuchung und keine Rechtsberatung, erhebt keinen Anspruch auf Vollständigkeit
oder Richtigkeit und ist keine Entscheidung eines Versorgungsamts oder Gerichts.
Für eine verbindliche Einschätzung: Facharzt/Fachärztin bzw. Beratung bei einem
Sozialverband (VdK, SoVD) oder Fachanwalt/-anwältin für Sozialrecht.

Möchten Sie Informationen zur Antragstellung oder passende Anlaufstellen?

REFERENZEN:
[1] Genaue Textstelle/Quelle aus der Wissensbasis unten, so konkret wie möglich
    (z.B. "VersMedV 18.4 i.V.m. 3.7, Stufe 'schwere Störung mit mittelgradigen
    sozialen Anpassungsschwierigkeiten'" oder "Kanadische Konsenskriterien (CCC),
    PEM-Kriterium" oder "SGB VII § 56, BK-Nr. 3101")
[2] ...

Der REFERENZEN-Block steht IMMER als letzter Block der Nachricht, beginnend exakt
mit der Zeile "REFERENZEN:" (Großschreibung, Doppelpunkt), gefolgt von einer
Zeile pro Eintrag im Format "[n] Text". Nur die Auswertungsnachricht enthält
diesen Block — normale Interviewfragen nicht.

${SYSTEM_KNOWLEDGE}`;
}

const STORAGE_NOTICE =
  "Dieser Chat wird nicht gespeichert. Mit Schließen dieses Fensters sind alle Ihre Angaben unwiderruflich weg — planen Sie die gut 15 Minuten möglichst am Stück ein. Lediglich anonym erfasst wird, in welchen GdB-/MdE-Bereich eine Einschätzung fällt und ob ein beruflicher Zusammenhang gesichert ist — nie der Gesprächsinhalt, nie mit Ihnen verknüpfbar.";

const DIAGNOSIS_WARNING =
  "Dies ist keine medizinische Beratung und kann keine Diagnose stellen oder ersetzen. Ohne gesicherte Diagnose ist eine ärztliche Untersuchung erforderlich.";

const CRISIS_NOTE =
  "Falls Sie sich gerade in einer Krise befinden oder daran denken, sich etwas anzutun: Die Telefonseelsorge erreichen Sie kostenlos und anonym unter 0800 111 0 111 oder 0800 111 0 222, rund um die Uhr.";

const ABOUT_TEXT = `BASTET ist ein Orientierungs- und Hilfsangebot, keine verbindliche Begutachtung, keine medizinische Diagnose und keine Rechtsberatung. Es ersetzt weder eine ärztliche Untersuchung noch anwaltliche Beratung und bindet keine Behörde, kein Gericht und keinen Versicherungsträger.

BASTET basiert auf großen Sprachmodellen (LLMs) und einer kuratierten Wissensbasis. Diese Technologie befindet sich in aktiver Forschung und Entwicklung, ist experimentell, und fehlerhafte oder unvollständige Ausgaben sind nicht auszuschließen. Für Vollständigkeit, Richtigkeit und Aktualität der Inhalte wird keine Gewähr übernommen. Alle Ausgaben dienen ausschließlich der Orientierung — Nutzer:innen bleiben selbst dafür verantwortlich, Angaben durch qualifizierte Fachpersonen prüfen zu lassen, bevor daraus Entscheidungen abgeleitet werden.

Soweit gesetzlich zulässig, ist eine Haftung für Schäden aus der Nutzung von BASTET ausgeschlossen; dies gilt nicht bei Verletzung von Leben, Körper oder Gesundheit sowie nicht bei Vorsatz oder grober Fahrlässigkeit.

© Schmitz & Hugenberg, Osnabrück. Alle Rechte vorbehalten — an Name, Marke, Quellcode und den redaktionell erstellten Inhalten (u. a. die kuratierte Wissensbasis). Das Repository ist öffentlich einsehbar, insbesondere für die Teilnahme an Hackathons; öffentliche Einsehbarkeit bedeutet nicht automatisch eine Open-Source-Lizenzierung. "Open Source" bezieht sich auf die zugrunde liegenden Quellen und Daten (u. a. VersMedV als amtliches Werk gemäß § 5 UrhG, Kanadische Konsenskriterien, veröffentlichte Sozialgerichtsentscheidungen) — deren Auswahl und Verknüpfung innerhalb von BASTET ist eine eigenständige redaktionelle Leistung.

BASTET ist ein Forschungsprojekt im Aufbau — Funktionsumfang und Wissensbasis entwickeln sich fortlaufend weiter.`;

function splitReferences(content) {
  const marker = "REFERENZEN:";
  const idx = content.indexOf(marker);
  if (idx === -1) return { body: content, refs: null };
  const body = content.slice(0, idx).trim();
  const refsBlock = content.slice(idx + marker.length).trim();
  const refs = refsBlock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\[\d+\]/.test(l));
  if (refs.length === 0) return { body: content, refs: null };
  return { body, refs };
}

function useAutoScroll(dep) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [dep]);
  return ref;
}

export default function App() {
  const [phase, setPhase] = useState("gate"); // gate | warned | chat | ended
  const [diagnosisConfirmed, setDiagnosisConfirmed] = useState(true);
  const [messages, setMessages] = useState([]); // {role, content}
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [turnCount, setTurnCount] = useState(0);
  const [lastHistory, setLastHistory] = useState(null);
  const [openRefs, setOpenRefs] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  async function copyText(text, markKey) {
    try {
      await navigator.clipboard.writeText(text);
      if (markKey === "all") {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
      } else {
        setCopiedIndex(markKey);
        setTimeout(() => setCopiedIndex(null), 2000);
      }
    } catch (e) {
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

  async function callClaude(history) {
    setLoading(true);
    setError(null);
    try {
      const budgetHint =
        turnCount >= 5
          ? "Das Budget ist erreicht — leite JETZT zur Auswertung über, auch wenn nicht alles erfragt ist."
          : `Bisher ${turnCount} von ca. 6-8 möglichen Austauschen genutzt.`;
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          system: buildSystemPrompt(diagnosisConfirmed, budgetHint),
          messages: history,
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        const detail =
          (data.error && (data.error.message || data.error.type)) ||
          `HTTP ${response.status}`;
        throw new Error(detail);
      }
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      if (!text) throw new Error("Antwort war leer (evtl. nur Tool-Aufruf ohne Text).");
      setMessages((m) => [...m, { role: "assistant", content: text }]);
      setLastHistory(null);
    } catch (e) {
      setError(
        "Technisches Problem: " +
          (e && e.message ? e.message : "unbekannter Fehler") +
          " — Ihre Angaben sind noch da, unten können Sie es erneut versuchen."
      );
      setLastHistory(history);
    } finally {
      setLoading(false);
    }
  }

  function startChat(confirmed) {
    setDiagnosisConfirmed(confirmed);
    setPhase("chat");
    const opening = {
      role: "assistant",
      content:
        "Danke. Erzählen Sie mir in eigenen Worten, was seit wann bei Ihnen los ist — Stichworte reichen völlig, Sie müssen keine ganzen Sätze schreiben.",
    };
    setMessages([opening]);
  }

  function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setTurnCount((c) => c + 1);
    callClaude(next.map(({ role, content }) => ({ role, content })));
  }

  function forceEvaluation() {
    if (loading) return;
    const directive = {
      role: "user",
      content:
        "[Bitte jetzt sofort mit den bisherigen Angaben die Auswertung erstellen. Markieren Sie, welche Punkte offen blieben.]",
    };
    const next = [...messages, directive];
    setMessages(next);
    callClaude(next.map(({ role, content }) => ({ role, content })));
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <img src={BASTET_BADGE} alt="BASTET" style={styles.topBarBadge} />
        <span style={styles.topBarWordmark}>BASTET</span>
      </div>
      <div style={styles.centerWrap}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Vorbegutachtung Post-COVID / ME-CFS</h1>
          <p style={styles.subtitle}>
            Eine orientierende, KI-gestützte Ersteinschätzung — kein Ersatz für
            ärztliche oder rechtliche Beratung.
          </p>
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
              <button
                style={styles.secondaryButton}
                onClick={() => setPhase("warned")}
              >
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
              <button
                style={styles.secondaryButton}
                onClick={() => startChat(false)}
              >
                Trotzdem orientierende Einschätzung
              </button>
              <button
                style={styles.primaryButton}
                onClick={() => setPhase("ended")}
              >
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
                          onClick={() =>
                            setOpenRefs((o) => ({ ...o, [i]: !o[i] }))
                          }
                        >
                          {isOpen
                            ? "Referenzen ausblenden"
                            : `Referenzen anzeigen (${refs.length})`}
                        </button>
                        <button
                          style={styles.refsButton}
                          onClick={() => copyText(m.content, i)}
                        >
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
                      onClick={() => lastHistory && callClaude(lastHistory)}
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
                rows={2}
              />
              <button
                style={styles.primaryButton}
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
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    background: "#F5F6F3",
    color: "#2B2E2C",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    display: "flex",
    flexDirection: "column",
  },
  topBar: {
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    background: "#1F3D2E",
  },
  topBarBadge: { width: 28, height: 28, borderRadius: "50%", display: "block" },
  topBarWordmark: {
    fontFamily: "Cambria, Georgia, serif",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: 1,
    color: "#C9A227",
  },
  centerWrap: { display: "flex", justifyContent: "center", padding: "24px 16px", flex: 1 },
  container: { width: "100%", maxWidth: 640 },
  header: { marginBottom: 20 },
  title: {
    fontSize: 22,
    fontWeight: 600,
    margin: 0,
    lineHeight: 1.3,
    color: "#2B2E2C",
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 1.6,
    color: "#5A5F5B",
    marginTop: 8,
  },
  aboutLink: {
    marginTop: 10,
    background: "none",
    border: "none",
    color: "#6E736F",
    fontSize: 12.5,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
  aboutPanel: {
    marginTop: 10,
    background: "#F2F4F1",
    border: "1px solid #DCE0DB",
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 12.5,
    lineHeight: 1.6,
    color: "#4A4F4B",
    whiteSpace: "pre-wrap",
  },
  gateCard: {
    background: "#FFFFFF",
    border: "1px solid #DCE0DB",
    borderRadius: 10,
    padding: "22px 20px",
  },
  noticeText: {
    fontSize: 16,
    lineHeight: 1.65,
    color: "#2B2E2C",
    margin: 0,
    fontWeight: 500,
  },
  warningText: {
    fontSize: 16,
    lineHeight: 1.65,
    color: "#8A5A20",
    background: "#FBF3E7",
    border: "1px solid #E9D3B0",
    borderRadius: 8,
    padding: "12px 14px",
    margin: 0,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 1.65,
    color: "#2B2E2C",
    marginTop: 14,
  },
  divider: { height: 1, background: "#E4E7E2", margin: "18px 0" },
  gateQuestion: { fontSize: 17, lineHeight: 1.6, fontWeight: 500, margin: 0 },
  buttonRow: { display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" },
  primaryButton: {
    background: "#4B6E68",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 8,
    padding: "12px 18px",
    fontSize: 15.5,
    fontWeight: 500,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#FFFFFF",
    color: "#4B6E68",
    border: "1.5px solid #4B6E68",
    borderRadius: 8,
    padding: "12px 18px",
    fontSize: 15.5,
    fontWeight: 500,
    cursor: "pointer",
  },
  progressLine: {
    fontSize: 13.5,
    color: "#6E736F",
    marginBottom: 10,
    letterSpacing: 0.1,
  },
  chatWindow: {
    background: "#FFFFFF",
    border: "1px solid #DCE0DB",
    borderRadius: 10,
    padding: 16,
    height: 420,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    background: "#F2F4F1",
    borderLeft: "3px solid #4B6E68",
    borderRadius: "4px 10px 10px 10px",
    padding: "10px 14px",
    fontSize: 16,
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
  },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "88%",
    background: "#4B6E68",
    color: "#FFFFFF",
    borderRadius: "10px 4px 10px 10px",
    padding: "10px 14px",
    fontSize: 16,
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  errorBox: {
    background: "#FDECEC",
    border: "1px solid #F0B8B8",
    color: "#8A2E2E",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 15,
  },
  refsArea: { marginTop: 10 },
  refsButton: {
    background: "none",
    border: "1px solid #4B6E68",
    color: "#4B6E68",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13.5,
    cursor: "pointer",
  },
  refsList: {
    marginTop: 8,
    paddingLeft: 18,
    fontSize: 14,
    lineHeight: 1.55,
    color: "#4A4F4B",
  },
  refsListItem: { marginBottom: 4 },
  inputRow: { display: "flex", gap: 10, marginTop: 12, alignItems: "flex-end" },
  textarea: {
    flex: 1,
    resize: "none",
    border: "1px solid #DCE0DB",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 16,
    fontFamily: "inherit",
    lineHeight: 1.5,
  },
  footerRow: {
    marginTop: 14,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  linkButton: {
    alignSelf: "flex-start",
    background: "none",
    border: "none",
    color: "#4B6E68",
    fontSize: 14.5,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
  crisisNote: { fontSize: 12.5, color: "#8A8F8A", lineHeight: 1.5 },
};
