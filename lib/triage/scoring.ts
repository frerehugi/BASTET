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
  // Eine einzige Frage deckt sowohl den beruflichen Zusammenhang als auch den
  // BK-3101-Anerkennungsstatus ab (siehe questions.ts) - "nein"/"unsicher" wie
  // zuvor, die übrigen drei Werte kodieren zugleich den Anerkennungsstatus.
  const beruflicherKontext = answers.beruflicherKontext as string | undefined;
  const pemAusloeseschwelle = answers.pemAusloeseschwelle as string | undefined;
  const schmerzschwere = answers.schmerzschwere as string | undefined;
  const alltagsverrichtungen = answers.alltagsverrichtungen as string | undefined;
  const objektiveTests = answers.objektiveTests as string | undefined;
  const autonomHfDokumentiert = answers.autonomHfDokumentiert as string | undefined;
  const atembeschwerden = answers.atembeschwerden as string | undefined;
  const diabetesStatus = answers.diabetesStatus as string | undefined;
  const paraesthesien = answers.paraesthesien as string | undefined;
  const schmerzausbreitung = answers.schmerzausbreitung as string | undefined;
  const medikation = answers.medikation as string | undefined;
  const medikationWirkung = answers.medikationWirkung as string | undefined;
  // pemTriggerart wird bewusst NICHT destrukturiert - fließt nur über
  // answersToContextText() (lib/triage/context.ts) als reines Kontext-Signal
  // in Tier 2 ein, ohne eigene Scoring-Logik in diesem Schritt.
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

  // Atembeschwerden (VersMedV Teil B, 8.3) und Diabetes mellitus (VersMedV
  // Teil B, 15.1) sind eigenständige körperliche Befunde außerhalb des
  // ME/CFS-Kernpakets oben (Fatigue/PEM/kognitiv/Schmerz/Schlaf/autonom/
  // psychisch) - siehe symptomliste-gdb-mde-abgleich.md, wo diese Domänen
  // bereits als eigenständig kalibriert, aber in computeTriage() bislang
  // nicht abgebildet dokumentiert waren (build/phase9-…-self-gatekeeper.md,
  // Tier-1-Härtung). Wirken hier bewusst nur als Boden auf die
  // Gesamt-GdB-Spanne (Gesamt-GdB-Prinzip, keine Addition, VersMedV Teil A
  // Nr. 3) - NICHT als Änderung von `globalfunktionSchweregrad`, das
  // ausschließlich die ME/CFS-Globalfunktionsstörung beschreibt und weiter
  // unten als Grundlage für die MdE-Krosswalk-Tabelle dient; ein anderes
  // Organsystem betreffend, darf es diese Einordnung nicht verfälschen.
  if (atembeschwerden && atembeschwerden !== "keine") {
    let atemVon = 0;
    let atemBis = 0;
    let atemLabel = "";
    if (atembeschwerden === "ruhe") {
      atemVon = 80;
      atemBis = 100;
      atemLabel = "schweren Grades (Atemnot bereits in Ruhe/bei leichtester Belastung)";
    } else if (atembeschwerden === "leichte-belastung") {
      atemVon = 50;
      atemBis = 70;
      atemLabel = "mittleren Grades (Atemnot bereits bei alltäglicher leichter Belastung)";
    } else if (atembeschwerden === "mittelschwere-belastung") {
      atemVon = 20;
      atemBis = 40;
      atemLabel = "geringen Grades (Atemnot bei mittelschwerer Belastung)";
    }
    // Beide Grenzen prüfen, nicht nur die untere: sonst würde ein Fall wie
    // "Baseline 50-60, Atembeschwerden 50-70" fälschlich als "kein Effekt"
    // behandelt, obwohl die Obergrenze (70) über der bisherigen (60) liegt -
    // beim synthetischen Kombinationstest entdeckt, siehe scoring.ts-Historie
    // zum gleichen Fix beim Parästhesien-Block.
    if (atemVon > gdbVon || atemBis > gdbBis) {
      gdbVon = Math.max(gdbVon, atemVon);
      gdbBis = Math.max(gdbBis, atemBis);
      gdbBegruendung.push(
        `Atemwegsbeeinträchtigung ${atemLabel} — nach VersMedV 8.3 eigenständig mit GdB ${atemVon}–${atemBis} zu bewerten, hebt die Gesamtspanne entsprechend an (Gesamt-GdB-Prinzip, keine Addition).`
      );
    } else {
      gdbBegruendung.push(
        `Atemwegsbeeinträchtigung ${atemLabel} — nach VersMedV 8.3 eigenständig mit GdB ${atemVon}–${atemBis} zu bewerten, liegt hier unterhalb der ohnehin bereits höheren Gesamteinschätzung und ändert die Spanne nicht zusätzlich.`
      );
    }
  }
  if (diabetesStatus && diabetesStatus !== "nein" && diabetesStatus !== "diaet") {
    let diabVon = 0;
    let diabBis = 0;
    let diabLabel = "";
    if (diabetesStatus === "insulin-instabil") {
      diabVon = 50;
      diabBis = 50;
      diabLabel = "unter Insulintherapie, instabile Stoffwechsellage (inkl. gelegentlicher schwerer Unterzuckerungen)";
    } else if (diabetesStatus === "insulin-stabil") {
      diabVon = 30;
      diabBis = 40;
      diabLabel = "unter Insulintherapie, stabile bis mäßig schwankende Stoffwechsellage";
    } else if (diabetesStatus === "orale-hypo") {
      diabVon = 20;
      diabBis = 20;
      diabLabel = "mit Medikamenten mit erhöhter Unterzuckerungsneigung eingestellt";
    } else if (diabetesStatus === "orale-nicht-hypo") {
      diabVon = 10;
      diabBis = 10;
      diabLabel = "mit Medikamenten ohne erhöhte Unterzuckerungsneigung eingestellt";
    }
    // Gleicher Fix wie beim Atembeschwerden-Block oben: beide Grenzen prüfen.
    if (diabVon > gdbVon || diabBis > gdbBis) {
      gdbVon = Math.max(gdbVon, diabVon);
      gdbBis = Math.max(gdbBis, diabBis);
      gdbBegruendung.push(
        `Diabetes mellitus, ${diabLabel} — nach VersMedV 15.1 eigenständig mit GdB ${diabVon}${diabBis > diabVon ? `–${diabBis}` : ""} zu bewerten, hebt die Gesamtspanne entsprechend an (Gesamt-GdB-Prinzip, keine Addition).`
      );
    } else {
      gdbBegruendung.push(
        `Diabetes mellitus, ${diabLabel} — nach VersMedV 15.1 eigenständig mit GdB ${diabVon}${diabBis > diabVon ? `–${diabBis}` : ""} zu bewerten, liegt hier unterhalb der ohnehin bereits höheren Gesamteinschätzung und ändert die Spanne nicht zusätzlich.`
      );
    }
  }

  // Periphere Dys-/Parästhesien (VersMedV 3.11, Polyneuropathie-Analogie) -
  // gleiches Prinzip wie Atembeschwerden/Diabetes oben: eigenständiger Boden,
  // keine Addition, keine Änderung von globalfunktionSchweregrad. Laut
  // Recherche eines der häufigsten Post-COVID-Symptome (gepoolte Prävalenz
  // ca. 33 %), kalibriert in schmerz-neuro-kardio-erweiterung.md inkl. eines
  // realen Gerichtsfalls (Hochstufung 20→30 bei zusätzlicher Kraftminderung/
  // Gangunsicherheit/therapieresistenten Schmerzen).
  if (paraesthesien && paraesthesien !== "keine") {
    let paraVon = 0;
    let paraBis = 0;
    let paraLabel = "";
    // Als Spannen statt Einzelwerte (wie Atembeschwerden/Diabetes oben) -
    // VersMedV 3.11 gibt für die Polyneuropathie-Analogie ebenfalls einen
    // Korridor je Schweregrad vor, keine scharfe Prozentzahl. Werte direkt aus
    // schmerz-neuro-kardio-erweiterung.md: "reine, milde Kribbelparästhesien
    // ohne funktionelle Auswirkung ... GdB 10-20", "erst mit nachweisbarer
    // Funktionsbeeinträchtigung ... steigt die Einstufung auf 30 und höher".
    // Deshalb 30-50 für die schwerste Stufe statt nur 30-40: Erst eine
    // Obergrenze ÜBER dem GdB-Default von 30-40 kann die Gesamtspanne bei
    // sonst mildem Verlauf tatsächlich anheben - mit einem einzelnen
    // Punktwert von 30 (erste Fassung dieses Blocks) wäre das nie möglich
    // gewesen, da gdbVon im gesamten Funktionsverlauf monoton nicht-fallend
    // ist und nie unter 30 sinkt.
    if (paraesthesien === "deutlich-mit-schwaeche") {
      paraVon = 30;
      paraBis = 50;
      paraLabel = "deutlich, mit zusätzlicher Kraftminderung/Gangunsicherheit";
    } else if (paraesthesien === "deutlich") {
      paraVon = 20;
      paraBis = 30;
      paraLabel = "deutlich, ohne motorische Begleitsymptome";
    } else if (paraesthesien === "leicht") {
      paraVon = 10;
      paraBis = 20;
      paraLabel = "leicht bis gelegentlich";
    }
    // Beide Grenzen prüfen, nicht nur die untere (paraVon > gdbVon allein
    // hätte den Fall verpasst, dass nur die Obergrenze etwas beiträgt, wie
    // bei "deutlich-mit-schwaeche" gegen einen Default von 30-40).
    if (paraVon > gdbVon || paraBis > gdbBis) {
      gdbVon = Math.max(gdbVon, paraVon);
      gdbBis = Math.max(gdbBis, paraBis);
      gdbBegruendung.push(
        `Periphere Dys-/Parästhesien, ${paraLabel} — nach VersMedV 3.11 (Polyneuropathie-Analogie) eigenständig mit GdB ${paraVon}–${paraBis} zu bewerten${paraesthesien === "deutlich-mit-schwaeche" ? " (Hochstufung bei zusätzlicher Kraftminderung/Gangunsicherheit, vgl. schmerz-neuro-kardio-erweiterung.md)" : ""}, hebt die Gesamtspanne entsprechend an (Gesamt-GdB-Prinzip, keine Addition).`
      );
    } else {
      gdbBegruendung.push(
        `Periphere Dys-/Parästhesien, ${paraLabel} — nach VersMedV 3.11 eigenständig mit GdB ${paraVon}–${paraBis} zu bewerten, liegt hier unterhalb der ohnehin bereits höheren Gesamteinschätzung.`
      );
    }
  }

  // Medikation (ccc-fragenkatalog-kalibrierung.md Abschnitt 8): fließt bewusst
  // NUR als Einordnungshinweis in die Begründung ein, NICHT als eigener
  // Erhöhungsfaktor oder Boden - anders als z. B. bei Parästhesien/Atem-
  // beschwerden gibt es hier keinen VersMedV-Punkt, der "schlechtes
  // Therapieansprechen" in eine eigene GdB-Spanne übersetzt, und ein
  // ungrundierter numerischer Aufschlag wäre reine Erfindung. Der eigentliche
  // Zweck ist Transparenz: die übrigen Angaben (Schmerz, PEM, Fatigue, ...)
  // beschreiben immer den Zustand UNTER der hier angegebenen Medikation, nie
  // den hypothetischen unbehandelten Verlauf - das soll für die Detailanalyse
  // und ein späteres Gutachten sichtbar bleiben, statt stillschweigend
  // vorausgesetzt zu werden.
  if (medikation === "ja") {
    if (medikationWirkung === "keine-besserung") {
      gdbBegruendung.push(
        "Regelmäßige ärztlich verordnete Medikation ohne wesentliche Besserung der Beschwerden — die übrigen Angaben spiegeln den Verlauf bereits unter Therapie wider, nicht einen zusätzlich unbehandelten Zustand."
      );
    } else if (medikationWirkung === "teilweise-besserung") {
      gdbBegruendung.push(
        "Regelmäßige ärztlich verordnete Medikation mit teilweiser Besserung — die übrigen Angaben beschreiben den bereits teilweise behandelten Zustand."
      );
    } else if (medikationWirkung === "deutliche-besserung") {
      gdbBegruendung.push(
        "Regelmäßige ärztlich verordnete Medikation mit deutlicher Besserung — die übrigen Angaben beschreiben den bereits durch Therapie gebesserten Zustand; unbehandelt wäre nach eigener Einschätzung von einer stärkeren Ausprägung auszugehen."
      );
    }
  } else if (medikation === "nein") {
    gdbBegruendung.push(
      "Aktuell keine regelmäßige ärztlich verordnete Medikation gegen die Beschwerden — die übrigen Angaben beschreiben den unbehandelten Verlauf."
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
  if (schmerzCount >= 3 || schmerzschwere === "kaum-auszuhalten" || schmerzausbreitung === "generalisiert") {
    erhoehungsfaktoren++;
    gdbBegruendung.push(
      schmerzausbreitung === "generalisiert"
        ? "Schmerzen nahezu am ganzen Körper spürbar — entspricht dem für die Fibromyalgie-Analogie verlangten, über mehrere Körperregionen verteilten Schmerzbild (schmerz-neuro-kardio-erweiterung.md), Einordnung über 18.4/3.7."
        : schmerzCount >= 3
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
  if (autonomHfDokumentiert === "ja") {
    erhoehungsfaktoren++;
    gdbBegruendung.push(
      "Dokumentierter Herzfrequenzanstieg beim Aufstehen (≥30 bpm bzw. auf ≥120 bpm, Schellong-/Kipptischtest) — erfüllt die POTS-Diagnosekriterien (Raj 2013, Canadian Cardiovascular Society 2020) und objektiviert die berichtete orthostatische Intoleranz zusätzlich (schmerz-neuro-kardio-erweiterung.md)."
    );
  }
  if (erhoehungsfaktoren >= 2 && gdbBis < 100) {
    gdbVon = Math.min(gdbVon + 10, 90);
    gdbBis = Math.min(gdbBis + 10, 100);
  }

  // --- 3. MdE (gesetzliche Unfallversicherung) ----------------------------
  const mdeEinschlaegig =
    beruflicherKontext === "anerkannt" ||
    beruflicherKontext === "gemeldet-offen" ||
    beruflicherKontext === "nicht-gemeldet";
  let mdeGrund: string;
  if (beruflicherKontext === "unsicher") {
    mdeGrund =
      "Beruflicher Zusammenhang als unsicher angegeben — MdE-Einschlägigkeit kann hier nicht eingeordnet werden, das sollte in der Detailanalyse geklärt werden.";
  } else if (!mdeEinschlaegig) {
    mdeGrund = "Kein beruflicher Zusammenhang angegeben — MdE nach SGB VII nicht einschlägig.";
  } else if (beruflicherKontext === "anerkannt") {
    mdeGrund = "Beruflicher Zusammenhang angegeben, BK-3101 bereits anerkannt — MdE-Bemessung einschlägig.";
  } else {
    mdeGrund =
      "Beruflicher Zusammenhang angegeben, BK-3101 " +
      (beruflicherKontext === "gemeldet-offen" ? "gemeldet, Verfahren offen" : "noch nicht gemeldet") +
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

  // --- 5. Konsistenzprüfung (einfache Widerspruchserkennung) ---------------
  // Kein Vorwurf, keine medizinische Plausibilitätsbewertung - nur ein
  // Hinweis auf Antwortkombinationen, die sich gegenseitig eher ausschließen,
  // damit die Detailanalyse gezielt nachfragen kann statt sie stillschweigend
  // zu verrechnen. Bewusst wenige, klar begründbare Regeln statt eines
  // allgemeinen Konsistenz-Solvers.
  const inkonsistenzen: string[] = [];
  if (alltagsverrichtungen === "bettlaegerig-nah" && arbeitsfaehigkeit === "ueber-6") {
    inkonsistenzen.push(
      "Weitgehend bettlägerig, gleichzeitig aber eine Arbeitsfähigkeit von 6 Std./Tag oder mehr angegeben — das kann an einem guten Tag bei stark schwankendem Verlauf liegen, oder an einem Missverständnis einer der beiden Fragen. In der Detailanalyse gezielt nachfragen."
    );
  }
  if (bellScoreValid && bellScoreNum >= 70 && alltagsverrichtungen === "bettlaegerig-nah") {
    inkonsistenzen.push(
      `Bell-Score ${bellScoreNum} (kaum eingeschränktes Leistungsniveau) bei gleichzeitig angegebener weitgehender Bettlägerigkeit — beide Angaben passen für sich genommen nicht zusammen, ggf. die Bell-Score-Schätzung noch einmal prüfen.`
    );
  }
  if (bellScoreValid && bellScoreNum < 40 && arbeitsfaehigkeit === "ueber-6") {
    inkonsistenzen.push(
      `Bell-Score ${bellScoreNum} (schwere Ausprägung) bei gleichzeitig angegebener Arbeitsfähigkeit von 6 Std./Tag oder mehr — beide Angaben passen für sich genommen nicht zusammen, ggf. in der Detailanalyse klären.`
    );
  }

  // --- 6. Offene Punkte / Empfehlung Detailanalyse -------------------------
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

  const empfehlungDetailanalyse =
    cccErfuellt === "ja" || cccErfuellt === "teilweise" || offenePunkte.length > 1 || inkonsistenzen.length > 0;

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
    inkonsistenzen,
  };
}
