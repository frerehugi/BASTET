import type { Answers, TriageResult } from "./types";

// Setzt die Kalibrierungsmatrix aus lib/knowledge/ccc-fragenkatalog-kalibrierung.md
// und die CCC-Formalkriterien aus lib/knowledge/postcovid-mecfs.md (Abschnitt 1)
// in eine reine, deterministische Funktion um. KEIN API-Call, KEIN LLM.
//
// Bewusste Vereinfachung: Das ist eine grobe Kurzauswertung mit Spannen, kein
// Ersatz für die Tier-2-Detailanalyse oder ein echtes Gutachten. Wo die
// Datenlage für eine engere Einschätzung nicht reicht, wird das explizit als
// "offener Punkt" ausgegeben statt eine falsche Präzision vorzutäuschen.

function asMulti(v: string | string[] | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function countRelevant(values: string[]): number {
  return values.filter((v) => v !== "keine").length;
}

export function computeTriage(answers: Answers): TriageResult {
  const pem = answers.pem as string | undefined;
  const pemErholung = answers.pemErholung as string | undefined;
  const dauer = answers.dauer as string | undefined;
  const schmerz = asMulti(answers.schmerz);
  const kognitiv = asMulti(answers.kognitiv);
  const autonom = asMulti(answers.autonom);
  const schlaf = answers.schlaf as string | undefined;
  const psychKomorbid = answers.psychKomorbid as string | undefined;
  const arbeitsfaehigkeit = answers.arbeitsfaehigkeit as string | undefined;
  const beruflicherKontext = answers.beruflicherKontext as string | undefined;
  const bk3101Status = answers.bk3101Status as string | undefined;

  const schmerzCount = countRelevant(schmerz);
  const kognitivCount = countRelevant(kognitiv);
  const autonomCount = countRelevant(autonom);

  // --- 1. CCC-Erfüllung ---------------------------------------------------
  const dauerErfuellt = dauer === "ja";
  const schlafErfuellt = !!schlaf && schlaf !== "unauffaellig";
  const cccDomains = {
    pemFatigue: pem === "ja",
    schlaf: schlafErfuellt,
    schmerz: schmerzCount >= 2,
    kognitiv: kognitivCount >= 2,
    autonom: autonomCount >= 1,
    dauer: dauerErfuellt,
  };
  const cccDetail: string[] = [
    `PEM/Fatigue: ${cccDomains.pemFatigue ? "erfüllt" : pem === "unklar" ? "unklar" : "nicht erfüllt"}`,
    `Schlafstörung: ${cccDomains.schlaf ? "erfüllt" : "nicht erfüllt"}`,
    `Schmerzen (≥2 von 5): ${cccDomains.schmerz ? "erfüllt" : `nicht erfüllt (${schmerzCount}/2)`}`,
    `Neurokognitiv (≥2 von 6): ${cccDomains.kognitiv ? "erfüllt" : `nicht erfüllt (${kognitivCount}/2)`}`,
    `Autonom/neuroendokrin/immunologisch (≥1): ${cccDomains.autonom ? "erfüllt" : "nicht erfüllt"}`,
    `Dauer ≥6 Monate: ${cccDomains.dauer ? "erfüllt" : "nicht erfüllt"}`,
  ];

  let cccErfuellt: TriageResult["cccErfuellt"];
  if (pem === "unklar") {
    cccErfuellt = "unklar";
  } else if (!cccDomains.pemFatigue) {
    cccErfuellt = "nein";
  } else {
    const erfuellteZusatzkriterien = [
      cccDomains.schlaf,
      cccDomains.schmerz,
      cccDomains.kognitiv,
      cccDomains.autonom,
      cccDomains.dauer,
    ].filter(Boolean).length;
    cccErfuellt = erfuellteZusatzkriterien === 5 ? "ja" : erfuellteZusatzkriterien >= 3 ? "teilweise" : "nein";
  }

  // --- 2. GdB-Spanne (grobe Einordnung, siehe Kalibrierungsmatrix) --------
  // Globalfunktion als Ausgangspunkt (Analogie Hirnschäden-Skala, VersMedV
  // 3.1.1 - siehe ccc-fragenkatalog-kalibrierung.md Abschnitt 2), approximiert
  // über Arbeitsfähigkeit + PEM-Erholungsdauer, da kein Bell-Score erhoben wird.
  let gdbVon = 30;
  let gdbBis = 40;
  const gdbBegruendung: string[] = [];
  const unsichereDatenlage =
    arbeitsfaehigkeit === "unklar" || (pem === "ja" && !pemErholung);

  if (arbeitsfaehigkeit === "unter-3" || pemErholung === "ueber-monat") {
    gdbVon = 70;
    gdbBis = 100;
    gdbBegruendung.push(
      "Schwere Globalfunktionsstörung (Arbeitsfähigkeit unter 3 Std./Tag bzw. PEM-Erholung über einen Monat) — Analogie zur Hirnschäden-Skala VersMedV 3.1.1, schwere Ausprägung."
    );
  } else if (arbeitsfaehigkeit === "3-bis-6" || pemErholung === "ueber-woche") {
    gdbVon = 50;
    gdbBis = 60;
    gdbBegruendung.push(
      "Mittelschwere Globalfunktionsstörung (Arbeitsfähigkeit 3–6 Std./Tag bzw. PEM-Erholung über eine Woche) — Analogie VersMedV 3.1.1, mittelschwere Ausprägung."
    );
  } else if (unsichereDatenlage) {
    gdbVon = 30;
    gdbBis = 70;
    gdbBegruendung.push(
      "Datenlage für eine engere Spanne nicht ausreichend (Arbeitsfähigkeit oder PEM-Erholungsdauer unklar) — bewusst weite Spanne statt falscher Präzision."
    );
  } else {
    gdbBegruendung.push(
      "Geringe bis mittelschwere Globalfunktionsstörung (Arbeitsfähigkeit ≥6 Std./Tag, PEM-Erholung innerhalb weniger Tage) — Analogie VersMedV 3.1.1, geringe Ausprägung."
    );
  }

  // Erhöhungsfaktoren (keine Addition, aber Anhebung der Spanne plausibel),
  // siehe versmedv-gdb-gds.md Gesamt-GdB-Prinzip.
  let erhoehungsfaktoren = 0;
  if (kognitivCount >= 4) {
    erhoehungsfaktoren++;
    gdbBegruendung.push(
      "Ausgeprägte neurokognitive Symptomatik (≥4 von 6 Bereichen) — spricht eher für die obere Spannenhälfte bzw. eine Anhebung, Analogie VersMedV 3.1.2."
    );
  }
  if (psychKomorbid === "ja-gesichert") {
    erhoehungsfaktoren++;
    gdbBegruendung.push(
      "Eigenständige, fachärztlich gesicherte psychiatrische Komorbidität — kann als Erhöhungsfaktor in die Gesamt-GdB-Bildung einfließen (keine Addition, VersMedV Teil A Nr. 3)."
    );
  }
  if (schmerzCount >= 3) {
    erhoehungsfaktoren++;
    gdbBegruendung.push(
      "Breites Schmerzbild (≥3 Lokalisationen) — je nach Charakter ggf. zusätzliche Einordnung über VersMedV 3.11 (Polyneuropathie-Analogie) zu prüfen."
    );
  }
  if (erhoehungsfaktoren >= 2 && gdbBis < 100) {
    gdbVon = Math.min(gdbVon + 10, 90);
    gdbBis = Math.min(gdbBis + 10, 100);
  }

  // --- 3. MdE (gesetzliche Unfallversicherung) ----------------------------
  const mdeEinschlaegig = beruflicherKontext === "ja";
  let mdeGrund: string;
  if (!mdeEinschlaegig) {
    mdeGrund = "Kein beruflicher Zusammenhang angegeben — MdE nach SGB VII nicht einschlägig.";
  } else if (bk3101Status === "anerkannt") {
    mdeGrund = "Beruflicher Zusammenhang angegeben, BK-3101 bereits anerkannt — MdE-Bemessung einschlägig.";
  } else {
    mdeGrund =
      "Beruflicher Zusammenhang angegeben, BK-3101 " +
      (bk3101Status === "gemeldet-offen" ? "gemeldet, Verfahren offen" : "noch nicht gemeldet") +
      " — dem Grunde nach einschlägig, MdE-Spanne unter Vorbehalt der Anerkennung.";
  }

  // --- 4. Erwerbsminderungsrente (SGB VI) ----------------------------------
  let emrKategorie: TriageResult["emrKategorie"];
  let emrBegruendung: string;
  switch (arbeitsfaehigkeit) {
    case "unter-3":
      emrKategorie = "voll";
      emrBegruendung = "Angegebenes Leistungsvermögen unter 3 Std./Tag entspräche dem Bereich der vollen Erwerbsminderung.";
      break;
    case "3-bis-6":
      emrKategorie = "teilweise";
      emrBegruendung = "Angegebenes Leistungsvermögen 3–6 Std./Tag entspräche dem Bereich der teilweisen Erwerbsminderung.";
      break;
    case "ueber-6":
      emrKategorie = "keine";
      emrBegruendung = "Angegebenes Leistungsvermögen ≥6 Std./Tag entspräche keiner Erwerbsminderung nach SGB VI.";
      break;
    default:
      emrKategorie = "nicht_erhoben";
      emrBegruendung =
        "Leistungsvermögen nicht sicher einschätzbar — eine sozialmedizinische Begutachtung müsste dies eigenständig klären.";
  }

  // --- 5. Offene Punkte / Empfehlung Detailanalyse -------------------------
  const offenePunkte: string[] = [];
  if (pem === "unklar") offenePunkte.push("Ob PEM vorliegt, ist noch unklar.");
  if (unsichereDatenlage) offenePunkte.push("Arbeitsfähigkeit bzw. PEM-Erholungsdauer nicht präzise genug für eine engere GdB-Spanne.");
  if (arbeitsfaehigkeit === "unklar") offenePunkte.push("Leistungsvermögen für die EMR-Einordnung nicht eingeschätzt.");
  offenePunkte.push("Objektive Tests (6-Minuten-Gehstrecke, Handkraftmessung, neuropsychologische Testung) wurden hier nicht erfasst.");

  const empfehlungDetailanalyse = cccErfuellt === "ja" || cccErfuellt === "teilweise" || offenePunkte.length > 1;

  return {
    cccErfuellt,
    cccDetail,
    gdbSpanneVon: gdbVon,
    gdbSpanneBis: gdbBis,
    gdbBegruendung,
    mdeEinschlaegig,
    mdeGrund,
    emrKategorie,
    emrBegruendung,
    dauerErfuellt,
    offenePunkte,
    empfehlungDetailanalyse,
  };
}
