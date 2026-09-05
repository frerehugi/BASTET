export interface ParsedAssessment {
  body: string;
  refs: string[] | null;
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
    .filter((l) => /^\[\d+\]/.test(l));
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
