// Wandelt die strukturierten Stage-1/Stage-2-Antworten (lib/interviewAnswers.ts)
// in den Text um, der als EINE Nutzer-Nachricht an das Modell geht (siehe
// lib/chat.ts runQuickAssessment/runDetailedAssessmentFromAnswers). Läuft
// einmalig innerhalb desselben Request/Response-Zyklus, der die Auswertung
// erzeugt — nichts hiervon wird persistiert (Ausnahme: bei aktivem
// PAYWALL_ENABLED landet das Ergebnis vorübergehend in der ohnehin schon
// bestehenden Assessment-Session, siehe lib/assessmentSession.ts).
import {
  SYMPTOM_OPTIONS,
  VORERKRANKUNG_OPTIONS,
  HERZ_SYMPTOM_OPTIONS,
  type Stage1Answers,
  type Stage2Answers,
  type Skippable,
  type JaNeinDetail,
} from "./interviewAnswers";

const SKIPPED_LABEL = "— übersprungen —";
const UNANSWERED_LABEL = "— keine Angabe —";
const NULL_CHOICE_LABEL = "— nicht beantwortet —";

// null (bewusst übersprungen) vs. "" (Feld leer gelassen, aber nicht aktiv
// übersprungen) werden absichtlich unterschiedlich beschriftet — beides darf
// im Auswertungstext NIE stillschweigend als "nein" erscheinen.
function fmtSkippable(value: Skippable): string {
  if (value === null) return SKIPPED_LABEL;
  if (value.trim() === "") return UNANSWERED_LABEL;
  return value.trim();
}

function fmtChoice(value: string | null, labels: Record<string, string>): string {
  if (value === null) return NULL_CHOICE_LABEL;
  return labels[value] ?? value;
}

function fmtList(keys: string[], options: readonly { key: string; label: string }[]): string {
  if (keys.length === 0) return "keine ausgewählt";
  const byKey = new Map(options.map((o) => [o.key, o.label]));
  return keys.map((k) => byKey.get(k) ?? k).join(", ");
}

function fmtJaNeinDetail(value: JaNeinDetail | null, jaLabel = "ja", neinLabel = "nein"): string {
  if (value === null) return NULL_CHOICE_LABEL;
  return value.ja ? `${jaLabel}${value.detail.trim() ? ` — ${value.detail.trim()}` : ""}` : neinLabel;
}

export function serializeStage1(a: Stage1Answers): string {
  const nachweisLabels: Record<string, string> = {
    pcr: "PCR",
    schnelltest: "Schnelltest",
    antikoerper: "Antikörper-Nachweis",
    vermutet: "nur vermutet, kein Test",
  };
  const akutLabels: Record<string, string> = {
    ambulant: "ambulant",
    normalstation: "Krankenhaus Normalstation",
    intensiv: "intensivmedizinisch",
  };
  const jnu: Record<string, string> = { ja: "ja", nein: "nein", unsicher: "unsicher" };
  const verlaufLabels: Record<string, string> = {
    durchgehend: "durchgehend",
    phasenweise: "mit beschwerdefreien Phasen",
    neu: "neu wieder aufgetreten",
  };
  const tendenzLabels: Record<string, string> = {
    gebessert: "eher gebessert",
    gleich: "gleich geblieben",
    verschlechtert: "verschlechtert",
  };

  const symptomeText =
    fmtList(a.symptome, SYMPTOM_OPTIONS) +
    (a.symptome.includes("andere") && a.symptomeAndere.trim() ? ` (andere: ${a.symptomeAndere.trim()})` : "");

  return `STUFE 1 — Basisangaben:
1. Infektionszeitpunkt (Monat/Jahr): ${a.infektionZeitpunkt.trim() || UNANSWERED_LABEL}
   Nachweisart: ${fmtChoice(a.nachweisart, nachweisLabels)}
2. Akutverlauf: ${fmtChoice(a.akutverlauf, akutLabels)}
3. Beruf/Tätigkeit zum Infektionszeitpunkt: ${a.beruf.trim() || UNANSWERED_LABEL}
4. Beruflicher Kontakt zu nachweislich Infizierten: ${fmtChoice(a.beruflicherKontakt, jnu)}
   Bereits BK-/Arbeitsunfall-Meldung bei BG/Unfallkasse: ${fmtChoice(a.bkMeldung, jnu)}
5. Beginn der Beschwerden (Wochen nach Infektion): ${a.beschwerdebeginnWochen.trim() || UNANSWERED_LABEL}
   Verlauf seither: ${fmtChoice(a.verlaufSeither, verlaufLabels)}
6. Gesamttendenz: ${fmtChoice(a.gesamttendenz, tendenzLabels)}
7. Symptomüberblick: ${symptomeText}
8. Relevante Vorerkrankungen vor der Infektion: ${fmtList(a.vorerkrankungen, VORERKRANKUNG_OPTIONS)}`;
}

export function serializeStage2(stage1: Stage1Answers, a: Stage2Answers): string {
  const latenzLabels: Record<string, string> = {
    sofort: "sofort",
    stunden: "nach Stunden",
    folgetag: "am Folgetag",
    variiert: "variiert",
  };
  const dauerLabels: Record<string, string> = {
    unter14h: "unter 14 Stunden",
    ab14h: "14 Stunden oder länger",
    variiert: "variiert",
    weissNicht: "weiß nicht",
  };
  const jnt: Record<string, string> = { ja: "ja", nein: "nein", teilweise: "teilweise" };
  const jn: Record<string, string> = { ja: "ja", nein: "nein" };
  const jnu: Record<string, string> = { ja: "ja", nein: "nein", unsicher: "unsicher" };
  const belastungsschwelleLabels: Record<string, string> = {
    kurz: "bereits bei kurzer Anstrengung",
    laenger: "erst nach längerer/wiederholter Belastung",
  };

  const vorerkrankungenDetailLines = stage1.vorerkrankungen
    .filter((k) => k !== "keine")
    .map((k) => {
      const label = VORERKRANKUNG_OPTIONS.find((o) => o.key === k)?.label ?? k;
      const detail = a.vorerkrankungenDetail[k];
      const behandeltLabels: Record<string, string> = {
        ja: "war behandelt/symptomatisch",
        nein: "war nicht behandelt",
        unauffaellig: "war unauffällig",
      };
      const status = detail ? fmtChoice(detail.behandelt, behandeltLabels) : NULL_CHOICE_LABEL;
      const verschlechtert = detail ? fmtChoice(detail.verschlechtert, jnu) : NULL_CHOICE_LABEL;
      return `   - ${label}: zum Infektionszeitpunkt ${status}; nach Infektion verschlechtert: ${verschlechtert}`;
    })
    .join("\n");

  const ptbsLine =
    stage1.akutverlauf === "intensiv"
      ? `23. PTBS-Hinweise (Wiedererleben, Vermeidung, Übererregung) nach intensivmedizinischer Behandlung: ${fmtChoice(a.ptbsHinweise, jnu)}\n`
      : "";

  const potsFollowUp =
    a.potsSymptome === "ja"
      ? `   Stehtest mit Herzfrequenzmessung: ${fmtSkippable(a.stehtest)}
   Hautbiopsie (Small-Fiber-Neuropathie): ${fmtSkippable(a.hautbiopsie)}`
      : "   (keine Folgefragen, da keine PoTS-Symptome berichtet)";

  return `STUFE 2 — Detailfragen (vollständig ausgefüllter Fragebogen, EIN Sitzungsdurchgang):

Fatigue/PEM
9. Art der Belastung + Beispiel: ${fmtSkippable(a.belastungsartBeispiel)}
10. Latenz bis Einsetzen: ${fmtChoice(a.latenz, latenzLabels)} · Dauer der Verschlechterung: ${fmtChoice(a.dauer, dauerLabels)}
11. Schlaf trotz ausreichender Zeit im Bett erholsam: ${fmtChoice(a.schlafErholsam, jnt)}
12. Führt Tagebuch zu PEM-Episoden: ${fmtChoice(a.tagebuch, jn)}

Kognitiv
13. Betroffene Alltagssituationen + formelle Testung (z.B. MoCA): ${fmtSkippable(a.kognitivAlltagUndTestung)}
14. Schwelle: ${fmtChoice(a.belastungsschwelle, belastungsschwelleLabels)}

Riech-/Schmeck
15. Verlust/Verzerrung, seit wann, Seite, standardisierte Testung: ${fmtSkippable(a.riechSchmeck)}
16. Beruflich besonders auf Geruchs-/Geschmackssinn angewiesen: ${fmtJaNeinDetail(a.beruflicheAbhaengigkeitSinne)}

Kreislauf/PoTS
17. Schwindel/Herzrasen beim Aufstehen: ${fmtChoice(a.potsSymptome, jn)}
${potsFollowUp}

Herz-Kreislauf
18. Symptome: ${fmtList(a.herzSymptome, HERZ_SYMPTOM_OPTIONS)} · Troponin in Akutphase erhöht (falls bekannt): ${fmtSkippable(a.troponin)}
19. Letztes Belastungs-/Spiroergometrie-Ergebnis: ${fmtSkippable(a.spiroergometrie)}

Atemwege
20. Atemnot/chronischer Husten, Spirometrie/Bodyplethysmographie/DLCO/Spiroergometrie: ${fmtSkippable(a.atemwege)}

Psyche
21. Depressive/ängstliche/traumabezogene Symptome bereits vor der Infektion: ${fmtChoice(a.psycheVorbestehend, jnu)}
22. Andere belastende Ereignisse im relevanten Zeitraum, die die Symptomatik unabhängig erklären könnten: ${fmtJaNeinDetail(a.andereEreignisse)}
${ptbsLine}
ME/CFS-Doppelprüfung (nutzt zusätzlich die Antworten zu PEM/Schlaf oben [9-11] und kognitiv/orthostatisch [13-14,17] — nicht erneut erhoben)
24. Seit mindestens 6 Monaten deutliche Aktivitätseinschränkung gegenüber der Zeit vor der Erkrankung, verbunden mit Müdigkeit: ${fmtChoice(a.aktivitaetseinschraenkung6mon, jn)}
25. CCC-Zusatzsymptome (Schmerzen sowie mind. 1 Symptom aus mind. 2 Kategorien autonom/neuroendokrin/immunologisch): ${a.cccSymptome.length > 0 ? a.cccSymptome.join(", ") : "keine ausgewählt"}

Vorschäden & Verlauf
26. Vorerkrankungen im Detail:
${vorerkrankungenDetailLines || "   (keine Vorerkrankungen in Stufe 1 angegeben)"}
27. Bisherige Reha (wann/wie lange/Ergebnis) + Veränderung der Arbeitsfähigkeit: ${fmtSkippable(a.rehaUndArbeitsfaehigkeit)}`;
}
