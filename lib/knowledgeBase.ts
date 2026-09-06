import fs from "fs";
import path from "path";

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
  "postcovid-symptomliste.md",
  "symptomliste-gdb-mde-abgleich.md",
  "ccc-fragenkatalog-kalibrierung.md",
  "nervensystem-psyche-herz-gdb.md",
  "neurologie-vergleichsfaelle.md",
  "schmerz-neuro-kardio-erweiterung.md",
  "schlaf-schwindel-kognitiv-faelle.md",
  "unfallversicherung-mde.md",
  "quellen.md",
];

let cached: string | null = null;

export function getKnowledgeBase(): string {
  if (cached) return cached;
  cached = FILES.map((file) => {
    const content = fs.readFileSync(path.join(KNOWLEDGE_DIR, file), "utf-8");
    return `### Quelle: ${file}\n\n${content.trim()}`;
  }).join("\n\n---\n\n");
  return cached;
}
