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
  const schlaf = asMulti(answers.schlaf);
  const psychKomorbid = answers.psychKomorbid as string | undefined;
  const arbeitsfaehigkeit = answers.arbeitsfaehigkeit as string | undefined;
  const beruflicherKontext = answers.beruflicherKontext as string | undefined;
  const bk3101Status = answers.bk3101Status as string | undefined;
  const pemAusloeseschwelle = answers.pemAusloeseschwelle as string | undefined;
  const schmerzschwere = answers.schmerzschwere as string | undefined;
  const alltagsverrichtungen = answers.alltagsverrichtungen as string | undefined;
  const objektiveTests = answers.objektiveTests as string | undefined;
  const bellScoreRaw = answers.bellScore as string | undefined;
  const bellScoreNum = bellScoreRaw && bellScoreRaw.trim() !== "" ? Number(bellScoreRaw) : NaN;
  const bellScoreValid = !Number.isNaN(bellScoreNum) && bellScoreNum >= 0 && bellScoreNum <= 100;

  const schmerzCount = countRelevant(schmerz);
  const kognitivCount = countRelevant(kognitiv);
  const autonomCount = countRelevant(autonom);

  // --- 1. CCC-Erfüllung ---------------------------------------------------
  const dauerErfuellt = dauer === "ja";
  const cccSchlafErfuellt = schlaf.length > 0 && !schlaf.includes("unauffaellig");
  // IOM/SEID verlangt konkret "nicht erholsamen Schlaf", nicht irgendeine
  // Schlafstörung (CCC ist hier breiter: auch Rhythmusstörung zählt).
  const iomSchlafErfuellt = schlaf.includes("nicht-erholsam");
  const cccDomains = {
    pemFatigue: pem === "ja",
    schlaf: cccSchlafErfuellt,
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

  // --- 1b. IOM-Kriterien (SEID, Institute of Medicine 2015) ---------------
  // Schlanker als CCC: Fatigue + PEM + nicht erholsamer Schlaf + Dauer sind
  // ALLE verpflichtend, zusätzlich mindestens eines von (kognitive
  // Beeinträchtigung ODER orthostatische Intoleranz) - nicht irgendein
  // autonomes Symptom, IOM verlangt hier konkret Orthostase.
  const iomOrthostatisch = autonom.includes("orthostatisch");
  const iomKognitivOderOrthostase = kognitivCount >= 1 || iomOrthostatisch;
  const iomDetail: string[] = [
    `PEM: ${pem === "ja" ? "erfüllt" : pem === "unklar" ? "unklar" : "nicht erfüllt"}`,
    `Nicht erholsamer Schlaf: ${iomSchlafErfuellt ? "erfüllt" : "nicht erfüllt"}`,
    `Dauer ≥6 Monate: ${dauerErfuellt ? "erfüllt" : "nicht erfüllt"}`,
    `Kognitive Beeinträchtigung ODER orthostatische Intoleranz (≥1): ${iomKognitivOderOrthostase ? "erfüllt" : "nicht erfüllt"}`,
  ];
  let iomErfuellt: TriageResult["iomErfuellt"];
  if (pem === "unklar") {
    iomErfuellt = "unklar";
  } else if (pem !== "ja") {
    iomErfuellt = "nein";
  } else {
    const iomZusatzkriterien = [iomSchlafErfuellt, dauerErfuellt, iomKognitivOderOrthostase].filter(Boolean).length;
    iomErfuellt = iomZusatzkriterien === 3 ? "ja" : iomZusatzkriterien >= 2 ? "teilweise" : "nein";
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
  // Schweregrad-Einordnung der Globalfunktionsstörung - dieselbe Herleitung wie
  // für die GdB-Spanne unten, aber als eigenes, wiederverwendbares Label, damit
  // Abschnitt 3 (MdE) unten dieselbe Grundlage nutzen kann, statt die
  // Bell-Score-/Arbeitsfähigkeit-Fallunterscheidung ein zweites Mal abzubilden.
  let globalfunktionSchweregrad: "leicht" | "mittel" | "schwer" | "unsicher" = "leicht";

  if (bellScoreValid) {
    // Bell-Score hat Vorrang vor der Arbeitsfähigkeit-/PEM-Erholungs-Näherung
    // (siehe Kommentar oben) - er ist die direktere, in der Literatur
    // (Scheibenbogen et al. in "Die Ärztliche Begutachtung") konkret mit
    // Erwerbsfähigkeit korrelierte Kennzahl.
    if (bellScoreNum < 40) {
      gdbVon = 70;
      gdbBis = 100;
      globalfunktionSchweregrad = "schwer";
      gdbBegruendung.push(
        `Bell-Score ${bellScoreNum} (unter 40) — nach Scheibenbogen et al. keine relevante Erwerbsfähigkeit mehr zu erwarten, Analogie VersMedV 3.1.1, schwere Ausprägung.`
      );
    } else if (bellScoreNum < 60) {
      gdbVon = 50;
      gdbBis = 60;
      globalfunktionSchweregrad = "mittel";
      gdbBegruendung.push(
        `Bell-Score ${bellScoreNum} (40–59) — nach Scheibenbogen et al. allenfalls leichte, sitzende Tätigkeit in flexibler Teilzeit vorstellbar, Analogie VersMedV 3.1.1, mittelschwere Ausprägung.`
      );
    } else {
      gdbBegruendung.push(
        `Bell-Score ${bellScoreNum} (ab 60) — nach Scheibenbogen et al. bei individuellem Pacing ggf. vollzeitnahe Teilnahme am Erwerbsleben möglich, Analogie VersMedV 3.1.1, geringe Ausprägung.`
      );
    }
  } else if (arbeitsfaehigkeit === "unter-3" || pemErholung === "ueber-monat") {
    gdbVon = 70;
    gdbBis = 100;
    globalfunktionSchweregrad = "schwer";
    gdbBegruendung.push(
      "Schwere Globalfunktionsstörung (Arbeitsfähigkeit unter 3 Std./Tag bzw. PEM-Erholung über einen Monat) — Analogie zur Hirnschäden-Skala VersMedV 3.1.1, schwere Ausprägung."
    );
  } else if (arbeitsfaehigkeit === "3-bis-6" || pemErholung === "ueber-woche") {
    gdbVon = 50;
    gdbBis = 60;
    globalfunktionSchweregrad = "mittel";
    gdbBegruendung.push(
      "Mittelschwere Globalfunktionsstörung (Arbeitsfähigkeit 3–6 Std./Tag bzw. PEM-Erholung über eine Woche) — Analogie VersMedV 3.1.1, mittelschwere Ausprägung."
    );
  } else if (unsichereDatenlage) {
    gdbVon = 30;
    gdbBis = 70;
    globalfunktionSchweregrad = "unsicher";
    gdbBegruendung.push(
      "Datenlage für eine engere Spanne nicht ausreichend (Arbeitsfähigkeit oder PEM-Erholungsdauer unklar) — bewusst weite Spanne statt falscher Präzision."
    );
  } else {
    gdbBegruendung.push(
      "Geringe bis mittelschwere Globalfunktionsstörung (Arbeitsfähigkeit ≥6 Std./Tag, PEM-Erholung innerhalb weniger Tage) — Analogie VersMedV 3.1.1, geringe Ausprägung."
    );
  }

  // Unabhängig von der obigen Herleitung: weitgehende Bettlägerigkeit ist ein
  // eigenständiger, starker Hinweis auf die obere Spanne (Analogie schwere
  // Hirnschädigung, siehe neurologie-vergleichsfaelle.md) - als Boden, nicht
  // als Ersatz für die übrige Begründung.
  if (alltagsverrichtungen === "bettlaegerig-nah") {
    gdbVon = Math.max(gdbVon, 70);
    gdbBis = 100;
    globalfunktionSchweregrad = "schwer";
    gdbBegruendung.push(
      "Weitgehend bettlägerig / auf Hilfe bei den meisten Alltagsverrichtungen angewiesen — spricht unabhängig von anderen Angaben für die obere Spanne, Analogie zur schweren Hirnschäden-Ausprägung."
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
  if (schmerzCount >= 3 || schmerzschwere === "kaum-auszuhalten") {
    erhoehungsfaktoren++;
    gdbBegruendung.push(
      schmerzCount >= 3
        ? "Breites Schmerzbild (≥3 Lokalisationen) — je nach Charakter ggf. zusätzliche Einordnung über VersMedV 3.11 (Polyneuropathie-Analogie) zu prüfen."
        : "Selbst berichtete Schmerzintensität \"kaum auszuhalten\" — spricht auch bei weniger Lokalisationen für eine zusätzliche Einordnung über VersMedV 3.11 (Polyneuropathie-Analogie)."
    );
  }
  if (pemAusloeseschwelle === "leichteste-alltagsbelastung") {
    erhoehungsfaktoren++;
    gdbBegruendung.push(
      "PEM tritt bereits bei leichtester Alltagsbelastung auf — spricht für eine schwerere Ausprägung, konsistent mit der Bell-Score-Logik zu Auslöseschwellen."
    );
  }
  if (objektiveTests === "auffaellig") {
    erhoehungsfaktoren++;
    gdbBegruendung.push(
      "Objektive Testung (z. B. 6-Minuten-Gehstrecke, Handkraftmessung, neuropsychologische Testung) mit auffälligem/pathologischem Ergebnis — stützt die geschilderte Symptomatik durch ein objektivierbares Untersuchungsinstrument (Scheibenbogen et al.)."
    );
  }
  if (erhoehungsfaktoren >= 2 && gdbBis < 100) {
    gdbVon = Math.min(gdbVon + 10, 90);
    gdbBis = Math.min(gdbBis + 10, 100);
  }

  // --- 3. MdE (gesetzliche Unfallversicherung) ----------------------------
  const mdeEinschlaegig = beruflicherKontext === "ja";
  let mdeGrund: string;
  if (beruflicherKontext === "unsicher") {
    mdeGrund =
      "Beruflicher Zusammenhang als unsicher angegeben — MdE-Einschlägigkeit kann hier nicht eingeordnet werden, das sollte in der Detailanalyse geklärt werden.";
  } else if (!mdeEinschlaegig) {
    mdeGrund = "Kein beruflicher Zusammenhang angegeben — MdE nach SGB VII nicht einschlägig.";
  } else if (bk3101Status === "anerkannt") {
    mdeGrund = "Beruflicher Zusammenhang angegeben, BK-3101 bereits anerkannt — MdE-Bemessung einschlägig.";
  } else {
    mdeGrund =
      "Beruflicher Zusammenhang angegeben, BK-3101 " +
      (bk3101Status === "gemeldet-offen" ? "gemeldet, Verfahren offen" : "noch nicht gemeldet") +
      " — dem Grunde nach einschlägig, MdE-Spanne unter Vorbehalt der Anerkennung.";
  }

  // Grobe MdE-Spanne, sofern einschlägig - eigene Krosswalk-Tabelle statt
  // 1:1-Übernahme der GdB-Spanne, weil GdB (VersMedV, amtliche Tabelle) und
  // MdE (GUV, reine Erfahrungswerte ohne amtliche Tabelle) für denselben
  // Gesundheitsschaden nach Fachliteratur systematisch unterschiedlich ausfallen
  // (siehe gdb-mde-systematik.md, unfallversicherung-mde.md). Krosswalk-Werte
  // aus neurologie-mde-guv-tabellen.md, Abschnitt 3 (Widder/Gaidzik,
  // hirnorganisches Psychosyndrom/zentrale vegetative Störungen - dieselbe
  // Globalfunktions-Analogie, die auch der GdB-Herleitung oben zugrunde liegt).
  let mdeSpanneVon: number | undefined;
  let mdeSpanneBis: number | undefined;
  const mdeBegruendung: string[] = [];
  if (mdeEinschlaegig) {
    switch (globalfunktionSchweregrad) {
      case "schwer":
        mdeSpanneVon = 60;
        mdeSpanneBis = 100;
        mdeBegruendung.push(
          "Schwere Globalfunktionsstörung — Analogie zu den GUV-Erfahrungswerten für hirnorganisches Psychosyndrom/zentrale vegetative Störungen, schwere Ausprägung (Widder/Gaidzik)."
        );
        break;
      case "mittel":
        mdeSpanneVon = 40;
        mdeSpanneBis = 50;
        mdeBegruendung.push(
          "Mittelschwere Globalfunktionsstörung — Analogie wie oben, mittlere Ausprägung."
        );
        break;
      case "unsicher":
        mdeSpanneVon = 20;
        mdeSpanneBis = 60;
        mdeBegruendung.push(
          "Datenlage für eine engere MdE-Spanne nicht ausreichend (Arbeitsfähigkeit, PEM-Erholungsdauer bzw. Bell-Score unklar) — bewusst weite Spanne statt falscher Präzision."
        );
        break;
      default:
        mdeSpanneVon = 20;
        mdeSpanneBis = 40;
        mdeBegruendung.push(
          "Geringe Globalfunktionsstörung — Analogie wie oben, geringe Ausprägung."
        );
    }

    // Kalibrierung gegen eine konkrete, veröffentlichte Post-COVID-MdE-
    // Entscheidung (siehe postcovid-mecfs.md Abschnitt 6): SG Heilbronn hat für
    // ein strukturell ähnliches Bild (Fatigue/PEM + leichtere kognitive Störung
    // + gesicherte psychische Komorbidität) MdE 30 festgestellt - deutlich unter
    // der oberen Hälfte der "mittel"-Spanne. Dient als Korrektiv gegen eine zu
    // hohe Einschätzung bei vergleichbarer Konstellation, nicht als Automatik.
    if (
      globalfunktionSchweregrad === "mittel" &&
      psychKomorbid === "ja-gesichert" &&
      kognitivCount >= 1 &&
      kognitivCount <= 3 &&
      mdeSpanneVon !== undefined &&
      mdeSpanneBis !== undefined
    ) {
      // Spanne um den realen Fallwert (30) verankern statt sie auf einen
      // einzelnen Punkt zu kollabieren - der Präzedenzfall zieht sowohl die
      // Unter- als auch die Obergrenze nach unten.
      mdeSpanneVon = Math.min(mdeSpanneVon, 30);
      mdeSpanneBis = Math.min(mdeSpanneBis, 40);
      mdeBegruendung.push(
        "Vergleichbares kombiniertes Bild (Fatigue/PEM, leichtere kognitive Störung, gesicherte psychische Komorbidität) wurde in SG Heilbronn, Urt. v. 12.12.2024 – S 2 U 426/24 (nicht rechtskräftig), mit MdE 30 % festgestellt — spricht dafür, hier nicht ohne Weiteres in Richtung 50 zu gehen."
      );
    }

    // Kein rechnerischer Aufschlag bei mehreren Erhöhungsfaktoren (anders als
    // beim GdB oben): Die GUV bildet die Gesamt-MdE bei mehreren betroffenen
    // Funktionsbereichen ausdrücklich "integrierend", eine Addition einzelner
    // MdE-Sätze ist unzulässig (DGUV, Grundlagen der Begutachtung von
    // Arbeitsunfällen, Abschn. 8.3, siehe unfallversicherung-mde.md).
    if (erhoehungsfaktoren >= 2) {
      mdeBegruendung.push(
        "Mehrere Funktionsbereiche gleichzeitig betroffen — die Gesamt-MdE wird dabei integrierend gebildet, nicht durch Addition einzelner Werte; das kann für die obere Spannenhälfte sprechen, aber keinen automatischen Aufschlag begründen."
      );
    }
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
  if (pem === "nein")
    offenePunkte.push(
      "CCC/IOM sind mangels PEM nicht erfüllt — das schließt eine andere postakute Infektionsfolge (PAIS) mit Fatigue/Belastungsintoleranz ohne PEM nicht aus. Das wäre diagnostisch etwas anderes als ME/CFS und sollte ärztlich eingeordnet werden, statt hier als 'keine relevante Erkrankung' missverstanden zu werden."
    );
  // Nur relevant, wenn nicht ohnehin ein Bell-Score vorliegt - der macht die
  // Unschärfe von Arbeitsfähigkeit/PEM-Erholung für die GdB-Spanne obsolet.
  if (unsichereDatenlage && !bellScoreValid)
    offenePunkte.push("Arbeitsfähigkeit bzw. PEM-Erholungsdauer nicht präzise genug für eine engere GdB-Spanne.");
  if (arbeitsfaehigkeit === "unklar") offenePunkte.push("Leistungsvermögen für die EMR-Einordnung nicht eingeschätzt.");
  if (beruflicherKontext === "unsicher")
    offenePunkte.push("Ob ein beruflicher Zusammenhang besteht, ist unsicher — relevant für die MdE-Einschlägigkeit.");
  if (!objektiveTests || objektiveTests === "unbekannt" || objektiveTests === "nein")
    offenePunkte.push(
      "Objektive Tests (6-Minuten-Gehstrecke, Handkraftmessung, neuropsychologische Testung) liegen nach eigener Angabe nicht vor — für die Detailanalyse/ein Gutachten relevant, falls im Verlauf noch durchgeführt."
    );

  const empfehlungDetailanalyse = cccErfuellt === "ja" || cccErfuellt === "teilweise" || offenePunkte.length > 1;

  return {
    cccErfuellt,
    cccDetail,
    iomErfuellt,
    iomDetail,
    gdbSpanneVon: gdbVon,
    gdbSpanneBis: gdbBis,
    gdbBegruendung,
    mdeEinschlaegig,
    mdeGrund,
    mdeSpanneVon,
    mdeSpanneBis,
    mdeBegruendung,
    emrKategorie,
    emrBegruendung,
    dauerErfuellt,
    offenePunkte,
    empfehlungDetailanalyse,
  };
}
