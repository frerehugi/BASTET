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

// Reihenfolge bewusst so gewählt, dass BG_KONTAKT_FILES (siehe unten) ganz am
// Ende stehen: getStaticKnowledgeBase(false) liefert dadurch exakt das
// Präfix von getStaticKnowledgeBase(true) bis zu deren Beginn - die beiden
// Bundle-Varianten teilen sich so den größtmöglichen gemeinsamen
// Cache-Präfix, statt für den ausgelassenen Teil in der Mitte zwei komplett
// getrennte Cache-Zeilen ab dem Auslassungspunkt zu erzeugen (siehe
// build/effizienz-plan.md Abschnitt 2, Prompt-Caching-Interaktion).
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
  "neurologie-mde-guv-tabellen.md",
  "schmerz-neuro-kardio-erweiterung.md",
  "schlaf-schwindel-kognitiv-faelle.md",
  "unfallversicherung-mde.md",
  "unfallversicherung-gutachter-befangenheit.md",
  "sgb-verfahrensrecht-begutachtung.md",
  "bg-pflichten-mitwirkung.md",
  "bg-behandlung-abrechnung.md",
  "haltung-mecfs-stellungnahme.md",
  "kritik-cfs-psychologisierung-vt-manual.md",
  "quellen.md",
  "sgb-index-alle-buecher.md",
];

/**
 * Reine Ablauf-/Kontakthilfen (BG-Adressen, Standardbrief-Vorlage) - erst
 * relevant, wenn tatsächlich ein BK-3101-Verfahren betrieben wird. Einziges
 * konkret umgesetztes Selektionskriterium aus build/effizienz-plan.md
 * Abschnitt 2 (bewusst konservativ: nur diese 2 von 21 Dateien, nur bei
 * eindeutig fehlendem Berufsbezug - siehe getStaticKnowledgeBase() unten).
 * Die übrigen BG-Dateien (Kausalitätsstufen, Verfahrensrecht) bleiben immer
 * drin, da sie auch die korrekte Begründung von "nicht einschlägig" stützen.
 */
const BG_KONTAKT_FILES = ["bg-kontaktdaten.md", "standardbrief-bgw.md"];

const staticCached: { full: string | null; standard: string | null } = { full: null, standard: null };

function renderFiles(files: string[]): string {
  return files
    .map((file) => {
      const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
      // Bewusst NICHT "Quelle: {file}" - das lädt dazu ein, den internen
      // Dateinamen selbst als REFERENZEN-Eintrag zu zitieren (beobachtet:
      // "postcovid-mecfs.md" als Zitat, das Telegram sogar automatisch als
      // Link darstellt, obwohl es keiner ist). Der Dateiname ist nur eine
      // interne Gruppierung, keine zitierfähige Quelle - siehe auch das
      // Zitierverbot in lib/chat.ts/lib/doc.ts (AUSWERTUNGS-FORMAT).
      return `### Interner Abschnitt (nicht zitierfähig, nur Gruppierung): ${file}\n\n${content.trim()}`;
    })
    .join("\n\n---\n\n");
}

/**
 * Byte-identisch über alle Anfragen/Nutzer:innen mit demselben `full`-Wert
 * hinweg (reine Git-Dateien, kein Redis-Zugriff) - bewusst getrennt von
 * getKnowledgeAddendum() exportiert, damit lib/chat.ts/lib/doc.ts diesen
 * Teil als eigenen, stabilen cache_control-Breakpoint verwenden können, ohne
 * dass ein freigegebenes Wissensbasis-Update (selten, siehe
 * getKnowledgeAddendum) die viel teurere Kern-Cache-Zeile mit invalidiert.
 * Siehe build/effizienz-plan.md Abschnitt 1.
 *
 * @param full false lässt BG_KONTAKT_FILES aus (siehe dortigen Kommentar) -
 *   nur von lib/chat.ts genutzt, und dort nur wenn aus dem Tier-1-Vorlauf
 *   bereits bekannt ist, dass kein beruflicher Zusammenhang besteht. Default
 *   true (voller Bestand) für alle anderen Aufrufer (lib/doc.ts, Telegram
 *   ohne Tier-1) - unverändertes Verhalten.
 */
export function getStaticKnowledgeBase(full: boolean = true): string {
  const key = full ? "full" : "standard";
  if (staticCached[key]) return staticCached[key]!;
  const files = full ? [...FILES, ...BG_KONTAKT_FILES] : FILES;
  staticCached[key] = renderFiles(files);
  return staticCached[key]!;
}

/**
 * Dynamischer Teil: per Update-Pipeline + menschlicher Freigabe in Upstash
 * abgelegte Aktualisierungen (siehe lib/reviewQueue.ts und
 * build/claude-code-buildplan.md Phase 4). Leerstring, wenn keine
 * freigegebenen Aktualisierungen vorliegen oder der Abruf fehlschlägt - ein
 * Ausfall des Redis-Abrufs darf die Kernfunktion nie blockieren, daher
 * best-effort mit stillem Fallback. Bewusst getrennt von
 * getStaticKnowledgeBase() zurückgegeben, damit die Aufrufer diesen (kleinen,
 * ungecachten) Teil separat ans Ende des System-Prompts stellen können, statt
 * ihn in den großen, gecachten Wissensbasis-Block zu mischen.
 */
export async function getKnowledgeAddendum(): Promise<string> {
  try {
    return await getApprovedAddendumText();
  } catch (error) {
    console.error("Konnte Wissensbasis-Aktualisierungen nicht laden, nutze nur den statischen Stand:", error);
    return "";
  }
}
