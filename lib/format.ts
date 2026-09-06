export interface ParsedAssessment {
  body: string;
  refs: string[] | null;
}

const MD_FILENAME_PATTERN = /[a-z0-9][a-z0-9-]*\.md\b/gi;

/**
 * Zweite, deterministische Verteidigungslinie gegen ein wiederholt
 * beobachtetes Modellverhalten: trotz explizitem Verbot im System-Prompt
 * (lib/chat.ts/lib/doc.ts, Abschnitt "NIEMALS einen internen Dateinamen...")
 * taucht gelegentlich doch ein interner Wissensbasis-Dateiname in einer
 * Referenz auf (z.B. "... – postcovid-mecfs.md"), den Telegram sogar als
 * klickbaren, aber toten Link darstellt. Prompt-Befolgung allein war nicht
 * zuverlässig genug, siehe build/testfaelle.md.
 */
export function stripKnowledgeFilenames(text: string): string {
  return text
    .replace(/\s*\([^()]*\.md\)/gi, "") // "(siehe X.md)", "(vgl. X.md)" - ganze Klammer
    // Verbindungswort/Gedankenstrich + Dateiname + optionales Komma, z.B.
    // " – X.md", " i.V.m. X.md,", " vgl. X.md" - als ganzer Ausdruck entfernen,
    // statt nur den Dateinamen und ein grammatisch verwaistes Anhängsel übrigzulassen.
    .replace(/\s*(?:[-–—]\s*|i\.\s?V\.\s?m\.\s*|vgl\.\s*|siehe\s*|s\.\s*)?[a-z0-9][a-z0-9-]*\.md\b,?/gi, "")
    .replace(MD_FILENAME_PATTERN, "") // letzter Auffangpass für alles übrig Gebliebene
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .trim();
}

/**
 * Trennt den REFERENZEN-Block (siehe AUSWERTUNGS-FORMAT in lib/chat.ts / lib/doc.ts)
 * vom übrigen Antworttext ab. Gemeinsam genutzt von Web-Arm (app/page.tsx,
 * app/doc/page.tsx) und Telegram-Arm (app/api/telegram/route.ts), damit es nur
 * eine Stelle gibt, die das Format kennt.
 */
export function splitReferences(content: string): ParsedAssessment {
  const marker = "REFERENZEN:";
  const idx = content.indexOf(marker);
  if (idx === -1) return { body: content, refs: null };
  const body = content.slice(0, idx).trim();
  const refsBlock = content.slice(idx + marker.length).trim();
  const refs = refsBlock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\[\d+\]/.test(l))
    .map(stripKnowledgeFilenames);
  if (refs.length === 0) return { body: content, refs: null };
  return { body, refs };
}

const STATS_MARKER = "STATS:";

/**
 * Entfernt einen maschinenlesbaren STATS:-Trailer (siehe Phase 7 im Buildplan),
 * falls das Modell einen anhängt. Aktuell instruieren die System-Prompts das
 * Modell nicht dazu, einen solchen Block zu erzeugen — diese Funktion ist reine
 * Verteidigung, falls sich das ändert: der Block darf niemals an Nutzer:innen
 * ausgeliefert werden (weder Web noch Telegram noch Doc-Arm), und wird hier nicht
 * ausgewertet oder gespeichert, nur verworfen.
 */
export function stripStatsBlock(content: string): string {
  const idx = content.indexOf(STATS_MARKER);
  if (idx === -1) return content;
  const before = content.slice(0, idx);
  const rest = content.slice(idx);
  const newlineIdx = rest.indexOf("\n");
  const after = newlineIdx === -1 ? "" : rest.slice(newlineIdx + 1);
  return (before + after).trim();
}
