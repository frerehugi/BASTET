import fs from "fs";
import path from "path";
import { getApprovedAddendumText } from "./reviewQueue";

/**
 * Volltext-Wissensbasis, 1:1 aus dem `de-begutachtung`-Claude-Skill (skill/de-begutachtung.skill)
 * übernommen — SKILL.md (Übersicht/Routing) plus alle references/*.md. Anders als die
 * knapperen, handkuratierten SYSTEM_KNOWLEDGE-Auszüge in den ursprünglichen Prototypen
 * bekommt das Modell hier den vollständigen, bereits recherchierten Bestand.
 */
const KNOWLEDGE_DIR = path.join(process.cwd(), "lib", "knowledge");

const FILES = [
  "SKILL.md",
  "gdb-mde-systematik.md",
  "versmedv-gdb-gds.md",
  "postcovid-mecfs.md",
  "scheibenbogen-aerztliche-begutachtung.md",
  "postcovid-symptomliste.md",
  "symptomliste-gdb-mde-abgleich.md",
  "ccc-fragenkatalog-kalibrierung.md",
  "nervensystem-psyche-herz-gdb.md",
  "neurologie-vergleichsfaelle.md",
  "schmerz-neuro-kardio-erweiterung.md",
  "schlaf-schwindel-kognitiv-faelle.md",
  "unfallversicherung-mde.md",
  "bg-pflichten-mitwirkung.md",
  "bg-kontaktdaten.md",
  "standardbrief-bgw.md",
  "quellen.md",
];

let staticCached: string | null = null;

function getStaticKnowledgeBase(): string {
  if (staticCached) return staticCached;
  staticCached = FILES.map((file) => {
    const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
    // Bewusst NICHT "Quelle: {file}" - das lädt dazu ein, den internen
    // Dateinamen selbst als REFERENZEN-Eintrag zu zitieren (beobachtet:
    // "postcovid-mecfs.md" als Zitat, das Telegram sogar automatisch als
    // Link darstellt, obwohl es keiner ist). Der Dateiname ist nur eine
    // interne Gruppierung, keine zitierfähige Quelle - siehe auch das
    // Zitierverbot in lib/chat.ts/lib/doc.ts (AUSWERTUNGS-FORMAT).
    return `### Interner Abschnitt (nicht zitierfähig, nur Gruppierung): ${file}\n\n${content.trim()}`;
  }).join("\n\n---\n\n");
  return staticCached;
}

/**
 * Statischer Teil (Git-Dateien, dauerhaft gecacht) plus dynamischer Teil
 * (per Update-Pipeline + menschlicher Freigabe in Upstash abgelegte
 * Aktualisierungen, siehe lib/reviewQueue.ts und build/claude-code-buildplan.md
 * Phase 4). Ohne freigegebene Aktualisierungen identisch zum rein statischen
 * Stand — ein Ausfall des Redis-Abrufs darf die Kernfunktion nie blockieren,
 * daher best-effort mit stillem Fallback auf den statischen Teil.
 */
export async function getKnowledgeBase(): Promise<string> {
  const staticPart = getStaticKnowledgeBase();
  let addendum = "";
  try {
    addendum = await getApprovedAddendumText();
  } catch (error) {
    console.error("Konnte Wissensbasis-Aktualisierungen nicht laden, nutze nur den statischen Stand:", error);
  }
  if (!addendum) return staticPart;
  return `${staticPart}\n\n---\n\n### Aktualisierungen (nach menschlicher Freigabe, siehe Update-Pipeline)\n\n${addendum}`;
}
