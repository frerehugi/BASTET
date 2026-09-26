"use client";

import { useEffect, useState } from "react";
import { splitReferences } from "@/lib/format";
import { splitStreamError } from "@/lib/streamProtocol";
import { AboutPanel } from "@/components/AboutPanel";
import { BellScoreReference } from "@/components/BellScoreReference";
import { PATIENT_ABOUT_TEXT as ABOUT_TEXT } from "@/lib/content";

// Self-Verifizierungs-Gate vor der eigentlichen Einschätzung (build/phase9-
// bastet-2.0-self-gatekeeper.md, 9d) - der Doc-Arm hatte bislang KEINERLEI
// Zugriffsschutz. Gleiches Muster wie beim Web-Arm-Gate in app/page.tsx
// (eigener Redirect-Roundtrip über sessionStorage, siehe dortige
// Kommentare), zwei bewusste Abweichungen:
// - Eigener Schalter (arm: "doc", lib/selfFeatureFlag.ts) statt des Web-Arm-
//   Schalters - Florian wollte Self zunächst NUR für den Doc-Arm aktivieren.
// - Anhänge (attachedFiles, teils mehrere MB Base64) werden bewusst NICHT
//   über den Redirect-Roundtrip mitgeschickt (sessionStorage-Quote-Risiko),
//   und nach erfolgreicher Verifizierung wird NICHT automatisch erneut
//   gesendet wie beim Web-Arm - sonst könnte eine Einschätzung
//   stillschweigend ohne die ursprünglich beigefügten Befunde entstehen.
//   Stattdessen: Formulartext wird wiederhergestellt, bei vorherigen
//   Anhängen ein klarer Hinweis, sie erneut hinzuzufügen, und ein erneuter,
//   bewusster Klick auf "Einschätzung erstellen" nötig.
// - Einmal pro Browser-Tab verifiziert (sessionStorage-Flag), nicht pro
//   einzelner Einschätzung - passend zum "einmalig, nicht pro Sitzung"-
//   Prinzip aus dem Plan, ohne dass es dafür ein eigenes Login-System gibt.
const SELF_DOC_STORAGE_PREFIX = "bastet:self:doc:pending:";
const SELF_DOC_VERIFIED_KEY = "bastet:self:doc:verified";

interface PersistedDocState {
  values: { beruf: string; anamnese: string; untersuchung: string; befunde: string };
  ccc: Record<string, string>;
  diagnosisCertain: "gesichert" | "verdacht";
  hadAttachments: boolean;
}

function persistDocStateForSelf(id: string, state: PersistedDocState) {
  try {
    sessionStorage.setItem(SELF_DOC_STORAGE_PREFIX + id, JSON.stringify(state));
  } catch {
    // sessionStorage kann fehlschlagen (privater Modus, voller Speicher) -
    // dann geht beim Rücksprung nur der Formularinhalt verloren, die
    // Verifizierung selbst bleibt davon unberührt (wie in app/page.tsx).
  }
}

function readAndClearDocStateForSelf(id: string): PersistedDocState | null {
  try {
    const raw = sessionStorage.getItem(SELF_DOC_STORAGE_PREFIX + id);
    sessionStorage.removeItem(SELF_DOC_STORAGE_PREFIX + id);
    return raw ? (JSON.parse(raw) as PersistedDocState) : null;
  } catch {
    return null;
  }
}

function isSelfVerifiedThisTab(): boolean {
  try {
    return sessionStorage.getItem(SELF_DOC_VERIFIED_KEY) === "1";
  } catch {
    return false;
  }
}

function markSelfVerifiedThisTab() {
  try {
    sessionStorage.setItem(SELF_DOC_VERIFIED_KEY, "1");
  } catch {
    // Fail-safe: schlägt das Setzen fehl, wird bei der nächsten Einschätzung
    // erneut gegated statt fälschlich dauerhaft "verifiziert" zu bleiben -
    // die sichere Fehlerrichtung (lieber einmal zu oft fragen als zu wenig).
  }
}

interface FieldDef {
  key: "beruf" | "anamnese" | "untersuchung" | "befunde";
  label: string;
  placeholder: string;
  rows: number;
  /** true bei "weitere Befunde" - dort wird unterhalb des Textfelds
   *  zusätzlich die Datei-/Bild-Upload-Steuerung gerendert. */
  allowUpload?: boolean;
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
  {
    key: "untersuchung",
    label: "Körperliche Untersuchung (Freitext)",
    placeholder: "Untersuchungsbefund, Vitalparameter, auffällige/unauffällige Befunde",
    rows: 3,
  },
  {
    key: "befunde",
    label: "Weitere Befunde (Freitext, Befunde, Screenshots etc.)",
    placeholder: "Laborwerte, Bildgebung, Testergebnisse — als Text oder als Anhang unten",
    rows: 3,
    allowUpload: true,
  },
];

// Grenzen client-seitig identisch zu app/api/doc/route.ts (dort zusätzlich
// serverseitig durchgesetzt) - Vercel-Functions begrenzen den Request-Body
// auf ca. 4,5 MB, Base64 bläht Binärdaten um ca. 1/3 auf.
const ALLOWED_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const MAX_FILES = 4;
const MAX_SINGLE_FILE_BASE64_CHARS = 4_000_000; // ~3 MB Rohgröße
const MAX_TOTAL_BASE64_CHARS = 4_500_000; // ~3,4 MB Rohgröße gesamt
// Bilder werden vor dem Versand client-seitig verkleinert (lange Kante,
// Pixel) und als JPEG neu encodiert - deckt den Regelfall (Fotos/Screenshots
// von Handys, oft mehrere MB) ab, ohne dass Nutzer:innen selbst komprimieren
// müssen. PDFs werden unverändert übernommen (keine Downscale-Möglichkeit).
const IMAGE_MAX_DIMENSION = 1600;
const IMAGE_JPEG_QUALITY = 0.82;

interface AttachedFile {
  id: string;
  name: string;
  mediaType: string;
  data: string; // base64, ohne "data:...;base64,"-Prefix
  approxBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Datei konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Bild konnte nicht dekodiert werden."));
    img.src = dataUrl;
  });
}

/**
 * Verkleinert ein Bild client-seitig auf IMAGE_MAX_DIMENSION (lange Kante)
 * und encodiert es als JPEG neu - reduziert typische Handyfotos/Screenshots
 * (oft mehrere MB) zuverlässig unter die Upload-Grenze, ohne dass Personen
 * selbst komprimieren müssen. Wirft bei Dekodierfehlern (z.B. exotisches
 * Format), Aufrufer fängt das ab und zeigt den Rohfehler nicht ungefiltert an.
 */
async function downscaleImage(file: File): Promise<{ mediaType: string; data: string }> {
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  const scale = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const outDataUrl = canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY);
  const base64 = outDataUrl.split(",")[1] ?? "";
  return { mediaType: "image/jpeg", data: base64 };
}

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
  const [values, setValues] = useState<{ beruf: string; anamnese: string; untersuchung: string; befunde: string }>({
    beruf: "",
    anamnese: "",
    untersuchung: "",
    befunde: "",
  });
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [ccc, setCcc] = useState<Record<string, string>>(initialCccState());
  const [diagnosisCertain, setDiagnosisCertain] = useState<"gesichert" | "verdacht">("gesichert");
  const [result, setResult] = useState<string | null>(null);
  const [refsOpen, setRefsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [selfError, setSelfError] = useState<string | null>(null);
  const [selfNotice, setSelfNotice] = useState<string | null>(null);
  const [selfCheckLoading, setSelfCheckLoading] = useState(false);

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

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setFileError(null);
    const incoming = Array.from(fileList);

    if (attachedFiles.length + incoming.length > MAX_FILES) {
      setFileError(`Höchstens ${MAX_FILES} Dateien insgesamt.`);
      return;
    }

    const next: AttachedFile[] = [...attachedFiles];
    for (const file of incoming) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setFileError(`Dateityp nicht unterstützt: ${file.name} (nur PNG, JPEG, WebP, PDF).`);
        return;
      }
      try {
        let mediaType: string;
        let data: string;
        if (file.type === "application/pdf") {
          const dataUrl = await readFileAsDataUrl(file);
          mediaType = "application/pdf";
          data = dataUrl.split(",")[1] ?? "";
        } else {
          const downscaled = await downscaleImage(file);
          mediaType = downscaled.mediaType;
          data = downscaled.data;
        }
        if (data.length > MAX_SINGLE_FILE_BASE64_CHARS) {
          setFileError(`Datei zu groß, auch nach Verkleinerung: ${file.name} (max. ca. 3 MB).`);
          return;
        }
        const totalChars = next.reduce((sum, f) => sum + f.data.length, 0) + data.length;
        if (totalChars > MAX_TOTAL_BASE64_CHARS) {
          setFileError("Die Dateien sind in Summe zu groß (max. ca. 3,4 MB insgesamt) — bitte einzeln hinzufügen.");
          return;
        }
        next.push({
          id: `${file.name}-${file.lastModified}-${data.length}`,
          name: file.name,
          mediaType,
          data,
          approxBytes: Math.round((data.length * 3) / 4),
        });
      } catch (e) {
        setFileError(
          `Konnte Datei nicht verarbeiten: ${file.name}` +
            (e instanceof Error ? ` (${e.message})` : "")
        );
        return;
      }
    }
    setAttachedFiles(next);
  }

  function removeFile(id: string) {
    setAttachedFiles((files) => files.filter((f) => f.id !== id));
    setFileError(null);
  }

  const canSubmit = values.anamnese.trim().length > 0 && ccc.dauer !== "";

  async function submitActual() {
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
Körperliche Untersuchung: ${values.untersuchung || "nicht angegeben"}
Weitere Befunde: ${values.befunde || "nicht angegeben"}${
        attachedFiles.length > 0
          ? ` (${attachedFiles.length} Anhang/Anhänge beigefügt, siehe Bild-/Dokumentinhalte)`
          : ""
      }
Diagnostische Sicherheit (Selbstangabe): ${diagnosisCertain === "gesichert" ? "Diagnose ärztlich gesichert" : "Diagnose noch nicht abschließend gesichert / Verdachtsdiagnose"}

Strukturierter CCC-Befund:
${cccLines}`;

      const response = await fetch("/api/doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput,
          files: attachedFiles.map((f) => ({ mediaType: f.mediaType, data: f.data })),
        }),
      });

      if (!response.ok) {
        // Fehler VOR Stream-Start (fehlender API-Key, ungültiger Request) -
        // kommt als normales JSON zurück (siehe app/api/doc/route.ts).
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

      setResult("");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        const { text } = splitStreamError(full);
        setResult(text);
      }

      const { error: streamError } = splitStreamError(full);
      if (streamError) {
        // Fehler MITTEN im Stream (z.B. max_tokens-Abbruch) - Teilantwort
        // verwerfen statt sie stillschweigend als vollständig stehen zu
        // lassen (gleiches Prinzip wie im Web-Chat-Arm).
        setResult(null);
        throw new Error(streamError);
      }
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

  /**
   * Self-Verifizierungs-Gate vor submitActual() (build/phase9-bastet-2.0-
   * self-gatekeeper.md, 9d) - arm: "doc", eigener Schalter, unabhängig vom
   * Web-Arm-Gate in app/page.tsx. Ist Self für den Doc-Arm ausgeschaltet
   * oder nicht konfiguriert, liefert /api/self/create-session
   * `{ enabled: false }` und hier passiert exakt das, was vor dieser
   * Integration passierte: sofortiger Start ohne Verifizierungsschritt.
   */
  async function handleSubmit() {
    if (!canSubmit || loading) return;

    if (isSelfVerifiedThisTab()) {
      await submitActual();
      return;
    }

    setSelfError(null);
    setSelfNotice(null);
    setSelfCheckLoading(true);
    try {
      const res = await fetch("/api/self/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ arm: "doc", returnPath: window.location.pathname }),
      });
      const data: { enabled: boolean; id?: string; verificationUrl?: string } = await res.json();
      if (!data.enabled || !data.id || !data.verificationUrl) {
        // Self für den Doc-Arm aus/nicht konfiguriert - wie vor der
        // Integration direkt starten, und den Tab als "verifiziert"
        // markieren, damit spätere Klicks hier nicht jedes Mal erneut den
        // (bereits als aus bekannten) Schalter abfragen.
        markSelfVerifiedThisTab();
        await submitActual();
        return;
      }
      persistDocStateForSelf(data.id, {
        values,
        ccc,
        diagnosisCertain,
        hadAttachments: attachedFiles.length > 0,
      });
      window.location.href = data.verificationUrl;
    } catch {
      await submitActual();
    } finally {
      setSelfCheckLoading(false);
    }
  }

  /**
   * Rücksprung von Self nach einem Verifizierungsversuch (Query-Parameter
   * `self=<externalUuid>`, siehe app/api/self/create-session) - gleiches
   * Prinzip wie in app/page.tsx, aber bewusst OHNE automatischen erneuten
   * Sendeversuch nach Erfolg (siehe Kommentar am Dateianfang: Anhänge gehen
   * über den Roundtrip verloren, ein stillschweigender erneuter Versand
   * würde eine unvollständige Einschätzung erzeugen, ohne dass das auffällt).
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const selfId = params.get("self");
    if (!selfId) return;
    const outcome = params.get("selfOutcome");
    window.history.replaceState(null, "", window.location.pathname);

    const restored = readAndClearDocStateForSelf(selfId);
    if (restored) {
      setValues(restored.values);
      setCcc(restored.ccc);
      setDiagnosisCertain(restored.diagnosisCertain);
    }
    const attachHint = restored?.hadAttachments
      ? " Zuvor hinzugefügte Anhänge sind dabei verlorengegangen — bitte erneut hinzufügen."
      : "";

    if (outcome === "failure") {
      setSelfError(
        'Die Self-Verifizierung wurde nicht abgeschlossen. Bitte "Einschätzung erstellen" erneut versuchen.' + attachHint
      );
      return;
    }

    setSelfCheckLoading(true);
    (async () => {
      const maxAttempts = 8;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const res = await fetch(`/api/self/session-status?id=${encodeURIComponent(selfId)}`);
          const data: { status: "pending" | "valid" | "invalid" } = await res.json();
          if (data.status === "valid") {
            markSelfVerifiedThisTab();
            setSelfCheckLoading(false);
            setSelfNotice("Verifizierung erfolgreich." + attachHint + ' Bitte "Einschätzung erstellen" erneut klicken.');
            return;
          }
          if (data.status === "invalid") {
            setSelfCheckLoading(false);
            setSelfError(
              'Die Self-Verifizierung war nicht erfolgreich. Bitte "Einschätzung erstellen" erneut versuchen.' + attachHint
            );
            return;
          }
        } catch {
          // einzelner Poll-Fehler wird ignoriert, nächster Versuch folgt
        }
        await new Promise((resolve) => setTimeout(resolve, 750));
      }
      setSelfCheckLoading(false);
      setSelfError(
        'Die Bestätigung der Verifizierung dauert ungewöhnlich lange. Bitte "Einschätzung erstellen" erneut versuchen.' +
          attachHint
      );
    })();
  }, []);

  function handleReset() {
    setValues({ beruf: "", anamnese: "", untersuchung: "", befunde: "" });
    setCcc(initialCccState());
    setDiagnosisCertain("gesichert");
    setAttachedFiles([]);
    setFileError(null);
    setResult(null);
    setRefsOpen(false);
    setError(null);
    setSelfError(null);
    setSelfNotice(null);
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
          {aboutOpen && (
            <AboutPanel
              text={ABOUT_TEXT}
              panelStyle={styles.aboutPanel}
              addressStyle={styles.aboutAddress}
              copyButtonStyle={styles.aboutCopyButton}
            />
          )}
        </header>

        <div style={styles.dutyBanner}>
          <span style={styles.dutyText}>
            Erinnerung: Bei begründetem Verdacht auf eine Berufskrankheit besteht nach § 202 SGB VII eine
            unverzügliche Meldepflicht — unabhängig von dieser Einschätzung.
          </span>
          <a
            style={styles.dutyLink}
            href="https://www.bgw-online.de/resource/blob/19848/43d953397aba7f893f63c119ae1472cb/K4050-Aerztliche-Anzeige-bei-Verdacht-auf-eine-Berufskrankheit-mit-Erlaeuterung.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Zum Meldeformular (BGW, K 4050)
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
              {f.allowUpload && (
                <div style={styles.uploadArea}>
                  <label style={styles.uploadButton}>
                    Datei/Bild hinzufügen
                    <input
                      type="file"
                      accept={ALLOWED_FILE_TYPES.join(",")}
                      multiple
                      style={{ display: "none" }}
                      onChange={(e) => {
                        void handleFilesSelected(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <span style={styles.uploadHint}>
                    PNG, JPEG, WebP oder PDF · max. {MAX_FILES} Dateien · Bilder werden automatisch verkleinert.
                  </span>
                  {fileError && <div style={styles.uploadError}>{fileError}</div>}
                  {attachedFiles.length > 0 && (
                    <ul style={styles.fileList}>
                      {attachedFiles.map((file) => (
                        <li key={file.id} style={styles.fileChip}>
                          <span style={styles.fileChipName}>
                            {file.name} ({formatBytes(file.approxBytes)})
                          </span>
                          <button
                            type="button"
                            style={styles.fileChipRemove}
                            onClick={() => removeFile(file.id)}
                            aria-label={`${file.name} entfernen`}
                          >
                            ✕
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p style={styles.uploadPrivacyNote}>
                    Bitte auf Bildern/Screenshots keine Namen, Geburtsdaten oder andere identifizierende Angaben
                    sichtbar lassen — vorher schwärzen. Dateien werden wie der übrige Text nur zur Erstellung der
                    Einschätzung übermittelt, nicht auf unseren Servern gespeichert.
                  </p>
                </div>
              )}
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
              {g.key === "fatigue" && (
                <BellScoreReference
                  linkStyle={styles.bellScoreLink}
                  panelStyle={styles.bellScorePanel}
                  rowStyle={styles.bellScoreRow}
                  valueStyle={styles.bellScoreValue}
                  textStyle={styles.bellScoreText}
                  sourceStyle={styles.bellScoreSource}
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
              style={{ ...styles.primaryButton, opacity: canSubmit && !loading && !selfCheckLoading ? 1 : 0.5 }}
              onClick={handleSubmit}
              disabled={!canSubmit || loading || selfCheckLoading}
            >
              {selfCheckLoading ? "Verifizierung wird geprüft …" : loading ? "Wird erstellt …" : "Einschätzung erstellen"}
            </button>
            <button style={styles.secondaryButton} onClick={handleReset} disabled={loading}>
              Zurücksetzen
            </button>
          </div>
          {loading && (
            <span style={styles.loadingHint}>
              Die Einschätzung wird laufend angezeigt, sobald der Text eintrifft — bei umfangreichen Angaben kann die
              Erstellung insgesamt bis zu 2 Minuten dauern.
            </span>
          )}

          {selfNotice && <div style={styles.selfNoticeBox}>{selfNotice}</div>}
          {selfError && <div style={styles.errorBox}>{selfError}</div>}
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
  aboutAddress: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "var(--text)",
  },
  aboutCopyButton: {
    marginLeft: 8,
    background: "var(--gold-dim)",
    border: "1px solid var(--border-gold)",
    color: "var(--gold-light)",
    borderRadius: 999,
    padding: "2px 10px",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
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
  bellScoreLink: {
    marginTop: 6,
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    fontSize: 11.5,
    textDecoration: "underline",
    cursor: "pointer",
    padding: 0,
    display: "block",
  },
  bellScorePanel: {
    marginTop: 6,
    background: "var(--card)",
    backdropFilter: "blur(20px)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "10px 12px",
  },
  bellScoreRow: { display: "flex", gap: 10, padding: "4px 0", borderBottom: "1px solid var(--border)" },
  bellScoreValue: { flex: "0 0 28px", fontWeight: 700, fontSize: 12.5, color: "var(--gold-light)" },
  bellScoreText: { fontSize: 11.5, lineHeight: 1.5, color: "var(--text-muted)" },
  bellScoreSource: { marginTop: 8, fontSize: 10.5, lineHeight: 1.5, color: "var(--text-faint)" },
  uploadArea: { marginTop: 8 },
  uploadButton: {
    display: "inline-block",
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border-gold)",
    color: "var(--gold-light)",
    borderRadius: 999,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  uploadHint: { display: "block", marginTop: 6, fontSize: 11.5, color: "var(--text-faint)", lineHeight: 1.5 },
  uploadError: {
    marginTop: 8,
    background: "rgba(248,113,113,.08)",
    border: "1px solid rgba(248,113,113,.35)",
    color: "var(--danger)",
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 12.5,
  },
  fileList: { listStyle: "none", margin: "8px 0 0", padding: 0, display: "flex", flexWrap: "wrap", gap: 6 },
  fileChip: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(255,255,255,.05)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "4px 6px 4px 10px",
    fontSize: 12,
    color: "var(--text)",
  },
  fileChipName: { maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  fileChipRemove: {
    background: "none",
    border: "none",
    color: "var(--text-faint)",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: 1,
    padding: 4,
  },
  uploadPrivacyNote: { marginTop: 8, fontSize: 11.5, lineHeight: 1.5, color: "var(--gold-light)" },
  buttonRow: { display: "flex", gap: 10, marginTop: 4 },
  loadingHint: { display: "block", marginTop: 8, fontSize: 12.5, color: "var(--text-faint)", lineHeight: 1.5 },
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
  selfNoticeBox: {
    marginTop: 12,
    background: "var(--gold-dim)",
    border: "1px solid var(--border-gold)",
    color: "var(--gold-light)",
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
