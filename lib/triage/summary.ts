import type { Answers, TriageResult } from "./types";

// Erzeugt die Kurzauswertung als reinen Textbaustein - KEIN API-Call. Das
// Format ist bewusst identisch zum AUSWERTUNGS-FORMAT aus lib/chat.ts (gleiche
// Überschriften, gleicher "REFERENZEN:"-Block), damit app/page.tsx dieselbe
// splitReferences()/isMdeEinschlaegig()/composeBgwLetter()-Logik unverändert
// weiterverwenden kann, egal ob die Auswertung von Tier 1 (regelbasiert) oder
// Tier 2 (LLM) stammt.

function summarizeAngaben(answers: Answers): string {
  const parts: string[] = [];
  if (answers.pem === "ja") {
    parts.push("Es besteht eine Post-exertionelle Malaise (PEM) mit verzögerter Verschlechterung nach Belastung");
  } else if (answers.pem === "unklar") {
    parts.push("Ob eine Post-exertionelle Malaise (PEM) vorliegt, ist noch unklar");
  }
  if (answers.schlaf && answers.schlaf !== "unauffaellig") {
    parts.push("eine Schlafstörung");
  }
  const schmerz = Array.isArray(answers.schmerz) ? answers.schmerz : [];
  if (schmerz.some((s) => s !== "keine")) {
    parts.push("Schmerzen in mehreren Bereichen (u. a. Muskel-/Kopfschmerz)");
  }
  const kognitiv = Array.isArray(answers.kognitiv) ? answers.kognitiv : [];
  if (kognitiv.some((s) => s !== "keine")) {
    parts.push("kognitive Einschränkungen (Konzentration/Wortfindung)");
  }
  const autonom = Array.isArray(answers.autonom) ? answers.autonom : [];
  if (autonom.some((s) => s !== "keine")) {
    parts.push("autonome Beschwerden (u. a. orthostatische Intoleranz)");
  }
  if (answers.psychKomorbid === "ja-gesichert") {
    parts.push("eine eigenständige, fachärztlich gesicherte psychiatrische Komorbidität");
  }
  if (parts.length === 0) return "Es wurden keine der abgefragten Kernsymptome bejaht.";
  return "Berichtet werden " + parts.join(", ") + ".";
}

function gdbLine(result: TriageResult): string {
  return `Geschätzte Spanne: ${result.gdbSpanneVon}–${result.gdbSpanneBis}`;
}

function emrLabel(result: TriageResult): string {
  switch (result.emrKategorie) {
    case "voll":
      return "unter 3 Std. = Bereich der vollen Erwerbsminderung";
    case "teilweise":
      return "3–6 Std. = Bereich der teilweisen Erwerbsminderung";
    case "keine":
      return "≥6 Std. = keine Erwerbsminderung";
    default:
      return "nicht erhoben";
  }
}

export function formatTriageSummary(answers: Answers, result: TriageResult): string {
  const refs: string[] = [];
  const refFor = (label: string): number => {
    const existing = refs.indexOf(label);
    if (existing !== -1) return existing + 1;
    refs.push(label);
    return refs.length;
  };

  const cccRef = refFor("Kanadische Konsenskriterien (CCC)");
  const iomRef = refFor("Institute of Medicine (IOM) 2015, SEID-Kriterien (\"Systemic Exertion Intolerance Disease\")");
  const gdbRef = refFor("VersMedV, Anlage Teil B Nr. 18.4 i. V. m. Nr. 3.7 (analoge Beurteilung bei ME/CFS/Fatigue-Syndromen)");
  const mdeRef = result.mdeEinschlaegig ? refFor("§ 56 Abs. 1 SGB VII, i. V. m. BK-Nr. 3101 BKV") : null;
  const emrRef = result.emrKategorie !== "nicht_erhoben" ? refFor("§ 43 SGB VI (Rente wegen Erwerbsminderung)") : null;

  const lines: string[] = [];
  lines.push("📋 Regelbasierte Ersteinschätzung — kein KI-Modell beteiligt, nicht medizinisch/juristisch verifiziert");
  lines.push("");
  lines.push(`Zusammenfassung Ihrer Angaben: ${summarizeAngaben(answers)}`);
  lines.push(
    `CCC-Kriterien erfüllt: ${result.cccErfuellt} [${cccRef}] · IOM-Kriterien (SEID) erfüllt: ${result.iomErfuellt} [${iomRef}] · Dauer ≥6 Monate: ${result.dauerErfuellt ? "ja" : "nein"}`
  );
  lines.push("");
  lines.push("── GdB (Schwerbehindertenrecht) ──");
  lines.push(gdbLine(result));
  lines.push("Begründung:");
  for (const b of result.gdbBegruendung) lines.push(`- ${b} [${gdbRef}]`);
  lines.push("");
  lines.push("── MdE (gesetzliche Unfallversicherung) ──");
  lines.push(`Einschlägig: ${result.mdeEinschlaegig ? "ja" : "nein"}`);
  lines.push(`${result.mdeGrund}${mdeRef ? ` [${mdeRef}]` : ""}`);
  lines.push("");
  lines.push("── Erwerbsminderungsrente (EMR, gesetzliche Rentenversicherung SGB VI) ──");
  lines.push(`Tägliches Leistungsvermögen: ${emrLabel(result)}`);
  lines.push(`${result.emrBegruendung}${emrRef ? ` [${emrRef}]` : ""}`);
  lines.push(
    "Zusätzlich: Das tägliche Leistungsvermögen ist nur eine von mehreren Voraussetzungen für einen tatsächlichen Rentenanspruch (daneben z. B. Mindestversicherungszeiten)."
  );
  lines.push("");
  if (result.offenePunkte.length > 0) {
    lines.push("Offene Punkte für eine genauere Einschätzung:");
    for (const p of result.offenePunkte) lines.push(`- ${p}`);
    lines.push("");
  }
  lines.push(
    "Wichtiger Hinweis: Dies ist eine automatisiert, rein regelbasiert erstellte Kurzeinschätzung auf Grundlage Ihrer eigenen, nicht überprüften Angaben. Sie ersetzt keine ärztliche Untersuchung, keine Rechtsberatung und kein Gutachten, erhebt keinen Anspruch auf Vollständigkeit oder Richtigkeit und ist keine Entscheidung eines Versorgungsamts oder Gerichts. Für eine verbindliche Einschätzung: Facharzt/Fachärztin bzw. Beratung bei einem Sozialverband (VdK, SoVD) oder Fachanwalt/-anwältin für Sozialrecht."
  );
  lines.push("");
  lines.push("REFERENZEN:");
  refs.forEach((r, i) => lines.push(`[${i + 1}] ${r}`));

  return lines.join("\n");
}
