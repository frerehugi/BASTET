import React, { useState } from "react";

const BASTET_BADGE = "data:image/png;base64,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";

const SYSTEM_KNOWLEDGE = `
WISSENSBASIS (Auszug, Prototyp — Produktivversion zieht dies live aus der
Wissensbasis):

VersMedV 18.4: CFS/Fibromyalgie analog zu beurteilen, meist über 3.7 (Neurosen/
Persönlichkeitsstörungen/Folgen psychischer Traumen): leichtere Störungen 0-20,
stärker behindernde Störungen mit wesentlicher Einschränkung 30-40, schwere
Störungen mit mittelgradigen sozialen Anpassungsschwierigkeiten 50-70, schwere
Störungen mit schweren sozialen Anpassungsschwierigkeiten 80-100.

VersMedV 3.1 (Hirnschäden, Kalibrierungsanker): kognitive Leistungsstörung
leicht 30-40 / mittelgradig 50-80 / schwer 90-100. Parkinson-Syndrom-Tabelle
analog für Bewegungsverlangsamung: 30-40 / 50-70 / 80-100.

Polyneuropathie/Parästhesien (3.11): motorische Ausfälle analog periphere
Nervenschäden, sensible Störungen/Schmerzen können schon bei geringer
Ausprägung erheblich beeinträchtigen (z.B. Feinmotorik). Realer Fall: brennende
Missempfindungen + Kraftminderung + Gangunsicherheit -> Einzel-GdB 30.

Chronische Schmerzen: kein eigener VersMedV-Punkt, Bewertung nach
Grunderkrankung bzw. interdisziplinär bei funktionellem/somatoformem Bild;
Fibromyalgie als Referenzfall eng mit ME/CFS über 18.4 verknüpft.

POTS/orthostatische Intoleranz: kein eigener VersMedV-Punkt, Bewertung analog
Kapitel 9 (Herz-Kreislauf, leistungsbasiert) und/oder als autonome CCC-Kategorie
über 18.4. Diagnosekriterien: HF-Anstieg >=30 bpm (oder auf >=120 bpm) binnen
10 Min nach Aufstehen/Kipptisch, ohne Blutdruckabfall, seit >=3 Monaten. Nur
ca. 30% der ME/CFS-Betroffenen haben formal nachweisbares POTS/OH - Ausschluss
schließt orthostatische Intoleranz nicht aus.

CCC-Kriterien ME/CFS: PEM zwingend (verzögerte, unverhältnismäßige
Verschlechterung nach Belastung), plus Schlafstörung, Schmerzen, neurokognitive
Symptome, autonome/neuroendokrine/immunologische Symptome. Dauer >=6 Monate
für GdB-Relevanz (§2 SGB IX).

Gesamt-GdB: keine Addition von Einzel-GdB. Unabhängige Beeinträchtigungen in
verschiedenen Lebensbereichen erhöhen tendenziell stärker als überschneidende
(Beispiel SG Aurich S4 SB 154/21: zwei unabhängige Hauptbeeinträchtigungen ->
Gesamt-GdB 50 statt 40).

MdE/SGB VII (nur bei Berufsbezug): BK-Nr. 3101 bei Infektion im Gesundheitsdienst/
Wohlfahrtspflege/Labor. Kausalitätsstufen: haftungsbegründend (Tätigkeit->
Erstinfektion) und haftungsausfüllend (Erstinfektion->heutige Folgeschäden) -
für beide gilt "hinreichende Wahrscheinlichkeit", kein Vollbeweis. Durchgehende
AU-/Symptomkette seit anerkannter Infektion trägt diesen Nachweis. Reale
Gegenentscheidung (Q-Fieber->CFS) zeigt: kein Automatismus, Kette muss
lückenlos/stimmig sein. Rentenanspruch ab MdE 20% über 26. Woche hinaus.
`;

function buildSystemPrompt() {
  return `Du bist eine fachliche Orientierungshilfe für Ärzt:innen zur GdB/MdE-
Einschätzung bei Post-COVID/ME-CFS im deutschen Sozialrecht. Zielgruppe sind
Fachkolleg:innen, keine Patient:innen - du sprichst kollegial, präzise, ohne
Erklärungen auf Laienniveau.

GRUNDREGELN (nicht verhandelbar):
- Du gibst eine fachliche Orientierung, keine verbindliche Begutachtung. Die
  eingebende Person trifft die eigene fachliche Beurteilung - das ist eine
  Zweitmeinung/Diskussionsgrundlage, kein Ersatz.
- Du gibst IMMER BEIDE Einschätzungen aus, GdB UND MdE - niemals nur eine
  davon, niemals einen Block stillschweigend weglassen. Ist MdE nicht
  einschlägig (kein beruflicher Zusammenhang angegeben), sagst du das
  ausdrücklich mit Begründung ("MdE nicht einschlägig, da ...") statt den
  Block wegzulassen.
- LÄNGENDISZIPLIN, damit beide Blöcke sicher Platz haben: Fasse dich pro
  CCC-Domäne in der Kurzeinordnung auf 1-2 Sätze, nicht auf einen eigenen
  Absatz pro Symptom. Die GdB-Begründung darf ausführlicher sein als die
  MdE-Begründung, aber beide MÜSSEN vollständig ausformuliert im Output
  stehen, inklusive Referenzen-Block danach. Schreibe die MdE-Sektion,
  BEVOR du Zeit/Platz auf zusätzliche Ausschmückungen der GdB-Begründung
  verwendest - lieber eine knappere, aber vollständige Antwort als eine
  lange, die vor dem Ende abgeschnitten wird.
- Belege JEDE Einschätzung mit einer konkreten Referenznummer [n], die im
  REFERENZEN-Block am Ende aufgelöst wird.
- Du bewertest ausschließlich die eingegebenen Angaben - keine Annahmen über
  nicht Genanntes.
- Du speicherst nichts. Die Eingabe ist anonymisiert und bleibt es.
- Am Ende IMMER der Hinweis, dass dies keine förmliche Begutachtung ersetzt.

AUSWERTUNGS-FORMAT:
📋 Fachliche Orientierung — keine förmliche Begutachtung

Kurzeinordnung: [2-3 Sätze, was aus den Angaben hervorgeht]
CCC-Kriterien: [erfüllt/teilweise/unklar anhand der Angaben] [n]
Dauer ≥6 Monate: [ja/nein/unklar] [n]

── GdB (Schwerbehindertenrecht) ──
Orientierende Spanne: XX–XX
Begründung:
[Fließtext mit [n]-Referenzen zu jeder Aussage, Bezug zu Kalibrierungsankern
wo passend - z.B. Vergleich mit Polyneuropathie/Parkinson/Hirnschäden-Tabellen
bei entsprechender Symptomatik]

── MdE (gesetzliche Unfallversicherung, SGB VII) ──
[IMMER ausfüllen, niemals weglassen:]
Einschlägig: [ja/nein, mit Begründung anhand des angegebenen beruflichen
Kontexts/BK-3101-Status]
Falls einschlägig: Orientierende MdE-Spanne: XX–XX, mit Begründung und
Bezug zur haftungsausfüllenden Kausalität (AU-/Symptomkette seit
Erstinfektion, Beweismaßstab "hinreichende Wahrscheinlichkeit") [n]
Falls nicht einschlägig: kurze Begründung, warum (z.B. kein Berufsbezug
angegeben, oder BK-3101 noch nicht anerkannt - dann Hinweis, dass die
Erstanerkennung Voraussetzung für eine MdE-Einschätzung ist) [n]

Hinweis: Diese Einschätzung basiert ausschließlich auf den eingegebenen,
anonymisierten Angaben und ersetzt keine förmliche sozialmedizinische
Begutachtung, keine Rechtsberatung und keine eigene fachliche Prüfung.

REFERENZEN:
[1] konkrete Textstelle/Quelle
[2] ...

${SYSTEM_KNOWLEDGE}`;
}

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

const FIELD_DEFS = [
  { key: "beruf", label: "Beruflicher Kontext / BK-3101", placeholder: "Tätigkeit, Datum akute Infektion, BK-3101-Status (nicht gemeldet/offen/anerkannt)", rows: 2 },
  { key: "anamnese", label: "Anamnese (frei)", placeholder: "Verlauf seit der Infektion, bisherige Diagnostik/Therapie, Vorerkrankungen", rows: 2 },
];

const CCC_GROUPS = [
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
      { key: "schlaf_art", label: "Art der Störung", options: ["nicht erholsam", "Ein-/Durchschlafstörung", "Tag-Nacht-Umkehr", "unauffällig"] },
      { key: "schlaf_tag", label: "Auswirkung tagsüber", options: ["keine relevante", "spürbar", "erheblich"] },
    ],
  },
  {
    key: "schmerz",
    title: "Schmerzen",
    fields: [
      { key: "schmerz_lok", label: "Lokalisation", options: ["Muskeln", "Gelenke (o. Schwellung)", "Kopf (neuer Typ)", "diffus", "keine"] },
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
    fields: [
      { key: "dauer", label: "Symptomdauer", options: ["<6 Monate", "≥6 Monate"] },
    ],
  },
];

function initialCccState() {
  const state = {};
  CCC_GROUPS.forEach((g) => {
    g.fields.forEach((f) => (state[f.key] = ""));
    if (g.freeKey) state[g.freeKey] = "";
  });
  return state;
}

const ABOUT_TEXT = `BASTET ist ein Orientierungs- und Hilfsangebot, keine verbindliche Begutachtung, keine medizinische Diagnose und keine Rechtsberatung. Es ersetzt weder eine ärztliche Untersuchung noch anwaltliche Beratung und bindet keine Behörde, kein Gericht und keinen Versicherungsträger.

BASTET basiert auf großen Sprachmodellen (LLMs) und einer kuratierten Wissensbasis. Diese Technologie befindet sich in aktiver Forschung und Entwicklung, ist experimentell, und fehlerhafte oder unvollständige Ausgaben sind nicht auszuschließen. Für Vollständigkeit, Richtigkeit und Aktualität der Inhalte wird keine Gewähr übernommen. Alle Ausgaben dienen ausschließlich der fachlichen Orientierung — die eigene fachliche Beurteilung bleibt maßgeblich.

Soweit gesetzlich zulässig, ist eine Haftung für Schäden aus der Nutzung von BASTET ausgeschlossen; dies gilt nicht bei Verletzung von Leben, Körper oder Gesundheit sowie nicht bei Vorsatz oder grober Fahrlässigkeit.

© Schmitz & Hugenberg, Osnabrück. Alle Rechte vorbehalten — an Name, Marke, Quellcode und den redaktionell erstellten Inhalten (u. a. die kuratierte Wissensbasis). Das Repository ist öffentlich einsehbar, insbesondere für die Teilnahme an Hackathons; öffentliche Einsehbarkeit bedeutet nicht automatisch eine Open-Source-Lizenzierung. "Open Source" bezieht sich auf die zugrunde liegenden Quellen und Daten (u. a. VersMedV als amtliches Werk gemäß § 5 UrhG, Kanadische Konsenskriterien, veröffentlichte Sozialgerichtsentscheidungen) — deren Auswahl und Verknüpfung innerhalb von BASTET ist eine eigenständige redaktionelle Leistung.

BASTET ist ein Forschungsprojekt im Aufbau — Funktionsumfang und Wissensbasis entwickeln sich fortlaufend weiter.`;

export default function App() {
  const [values, setValues] = useState({ beruf: "", anamnese: "" });
  const [ccc, setCcc] = useState(initialCccState());
  const [diagnosisCertain, setDiagnosisCertain] = useState("gesichert");
  const [result, setResult] = useState(null);
  const [refsOpen, setRefsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2800,
          system: buildSystemPrompt(),
          messages: [{ role: "user", content: userInput }],
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        const detail = (data.error && (data.error.message || data.error.type)) || `HTTP ${response.status}`;
        throw new Error(detail);
      }
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      if (!text) throw new Error("Antwort war leer.");
      setResult(text);
    } catch (e) {
      setError("Technisches Problem: " + (e && e.message ? e.message : "unbekannter Fehler") + " — nichts wurde gespeichert, erneut versuchen.");
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

  const [copied, setCopied] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  async function copyResult() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Clipboard-API evtl. blockiert im eingebetteten Kontext - Button bleibt nutzbar
    }
  }

  const parsed = result ? splitReferences(result) : null;

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <img src={BASTET_BADGE} alt="BASTET" style={styles.topBarBadge} />
        <span style={styles.topBarWordmark}>BASTET</span>
      </div>
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
            Erinnerung: Bei begründetem Verdacht auf eine Berufskrankheit besteht nach § 202 SGB VII eine unverzügliche Meldepflicht — unabhängig von dieser Einschätzung.
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
          Bitte keine Namen, Fallnummern oder seltene Zusatzmerkmale eingeben, die eine Zuordnung zu einer Person erlauben könnten. Es wird nichts gespeichert. Anonym erfasst wird lediglich, in welchen GdB-/MdE-Bereich eine Einschätzung fällt und ob ein beruflicher Zusammenhang gesichert ist — nie die Eingabe selbst, nie mit einer Sitzung verknüpfbar.
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
                        style={ccc[f.key] === opt ? styles.chipActive : styles.chip}
                        onClick={() => setCcc((c) => ({ ...c, [f.key]: opt }))}
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
                  onChange={(e) => setCcc((c) => ({ ...c, [g.freeKey]: e.target.value }))}
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
                  <li key={i} style={styles.refsListItem}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100%",
    background: "#F5F7F8",
    color: "#1A2229",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
    background: "#16302A",
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
  container: { width: "100%", maxWidth: 720 },
  header: { marginBottom: 16 },
  headerTop: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  title: { fontSize: 21, fontWeight: 650, margin: 0, color: "#1A2229", letterSpacing: -0.2 },
  badge: {
    fontSize: 12.5,
    fontWeight: 600,
    color: "#2F5C56",
    background: "#E4ECEA",
    borderRadius: 5,
    padding: "3px 8px",
  },
  subtitle: { fontSize: 14.5, lineHeight: 1.55, color: "#4E5A61", marginTop: 8 },
  aboutLink: {
    marginTop: 8,
    background: "none",
    border: "none",
    color: "#7A858C",
    fontSize: 12,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
  },
  aboutPanel: {
    marginTop: 8,
    background: "#EEF2F6",
    border: "1px solid #CBD8E0",
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#3B454C",
    whiteSpace: "pre-wrap",
  },
  dutyBanner: {
    background: "#EEF2F6",
    border: "1px solid #CBD8E0",
    borderRadius: 8,
    padding: "10px 14px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 10,
  },
  dutyText: { fontSize: 13, lineHeight: 1.5, color: "#35507A", flex: 1, minWidth: 220 },
  dutyLink: {
    fontSize: 13,
    fontWeight: 600,
    color: "#35507A",
    whiteSpace: "nowrap",
    textDecoration: "underline",
  },
  anonNotice: {
    fontSize: 12.5,
    lineHeight: 1.5,
    color: "#8A5A20",
    background: "#FBF3E7",
    border: "1px solid #E9D3B0",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 18,
  },
  form: {
    background: "#FFFFFF",
    border: "1px solid #DCE1E4",
    borderRadius: 10,
    padding: "20px 20px 16px",
  },
  fieldGroup: { marginBottom: 16 },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#1A2229", marginBottom: 6 },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #DCE1E4",
    borderRadius: 7,
    padding: "9px 11px",
    fontSize: 14.5,
    lineHeight: 1.5,
    fontFamily: "inherit",
    resize: "vertical",
    color: "#1A2229",
  },
  radioRow: { display: "flex", gap: 20, flexWrap: "wrap" },
  radioLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, color: "#33393E" },
  cccDivider: {
    fontSize: 13,
    fontWeight: 600,
    color: "#2F5C56",
    borderTop: "1px solid #DCE1E4",
    paddingTop: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  cccGroup: {
    marginBottom: 16,
    paddingBottom: 14,
    borderBottom: "1px solid #EEF1F2",
  },
  cccTitle: { fontSize: 13.5, fontWeight: 650, color: "#1A2229", marginBottom: 8 },
  cccFieldRow: { marginBottom: 8 },
  cccFieldLabel: { display: "block", fontSize: 12.5, color: "#5C666C", marginBottom: 4 },
  chipRow: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: {
    fontSize: 12.5,
    padding: "5px 10px",
    borderRadius: 14,
    border: "1px solid #DCE1E4",
    background: "#FFFFFF",
    color: "#33393E",
    cursor: "pointer",
  },
  chipActive: {
    fontSize: 12.5,
    padding: "5px 10px",
    borderRadius: 14,
    border: "1px solid #2F5C56",
    background: "#2F5C56",
    color: "#FFFFFF",
    cursor: "pointer",
  },
  smallInput: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #DCE1E4",
    borderRadius: 6,
    padding: "7px 10px",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#1A2229",
    marginTop: 4,
  },
  buttonRow: { display: "flex", gap: 10, marginTop: 4 },
  primaryButton: {
    background: "#2F5C56",
    color: "#FFFFFF",
    border: "none",
    borderRadius: 7,
    padding: "10px 18px",
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#FFFFFF",
    color: "#4E5A61",
    border: "1px solid #DCE1E4",
    borderRadius: 7,
    padding: "10px 16px",
    fontSize: 14.5,
    fontWeight: 500,
    cursor: "pointer",
  },
  errorBox: {
    marginTop: 12,
    background: "#FDECEC",
    border: "1px solid #F0B8B8",
    color: "#8A2E2E",
    borderRadius: 7,
    padding: "9px 12px",
    fontSize: 13.5,
  },
  resultCard: {
    marginTop: 16,
    background: "#FFFFFF",
    border: "1px solid #DCE1E4",
    borderLeft: "3px solid #2F5C56",
    borderRadius: "4px 9px 9px 9px",
    padding: "16px 18px",
  },
  resultBody: { fontSize: 14.5, lineHeight: 1.6, whiteSpace: "pre-wrap", color: "#1A2229" },
  refsArea: { marginTop: 12 },
  refsButton: {
    background: "none",
    border: "1px solid #2F5C56",
    color: "#2F5C56",
    borderRadius: 6,
    padding: "6px 10px",
    fontSize: 13,
    cursor: "pointer",
  },
  refsList: { marginTop: 8, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.55, color: "#4E5A61" },
  refsListItem: { marginBottom: 4 },
};
