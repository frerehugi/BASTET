// Datenmodell für den zweistufigen, formularbasierten Betroffenen-Interview
// (ersetzt das frühere Freitext-Chat-Interview im Web-Arm). Bewusst rein
// clientseitiger Zustand (React State in app/page.tsx) — nichts davon wird
// zwischengespeichert, bevor eine Stufe abgeschlossen und abgeschickt wird.
// Telegram bleibt unberührt und nutzt weiterhin das freie Chat-Interview
// (lib/chat.ts runInterview).

export const SYMPTOM_OPTIONS = [
  { key: "fatigue", label: "Fatigue/Erschöpfung" },
  { key: "pem", label: "Verschlechterung nach Anstrengung" },
  { key: "kognitiv", label: 'Kognitive Probleme ("Brain Fog")' },
  { key: "riechschmeck", label: "Riech-/Schmeckstörung" },
  { key: "atemnot", label: "Atemnot/Husten" },
  { key: "pots", label: "Herzrasen/Schwindel beim Aufstehen" },
  { key: "schmerzen", label: "Schmerzen" },
  { key: "schlaf", label: "Schlafstörungen" },
  { key: "psyche", label: "Depressive/ängstliche Symptome" },
  { key: "andere", label: "Andere" },
] as const;
export type SymptomKey = (typeof SYMPTOM_OPTIONS)[number]["key"];

export const VORERKRANKUNG_OPTIONS = [
  { key: "psyche", label: "Psyche" },
  { key: "schmerz", label: "Schmerz" },
  { key: "herz", label: "Herz-Kreislauf" },
  { key: "lunge", label: "Lunge" },
  { key: "neurologie", label: "Neurologie" },
  { key: "keine", label: "Keine" },
] as const;
export type VorerkrankungKey = (typeof VORERKRANKUNG_OPTIONS)[number]["key"];

export const HERZ_SYMPTOM_OPTIONS = [
  { key: "stolpern", label: "Herzstolpern" },
  { key: "brustschmerz", label: "Brustschmerz" },
  { key: "rhythmusstoerung", label: "Bekannte Rhythmusstörung" },
  { key: "schrittmacher", label: "Schrittmacher/ICD" },
] as const;

export const CCC_KATEGORIEN = [
  {
    key: "autonom",
    label: "Autonom",
    beispiele: "z.B. orthostatische Intoleranz, Herzrasen, Verdauungsprobleme",
  },
  {
    key: "neuroendokrin",
    label: "Neuroendokrin",
    beispiele: "z.B. Temperaturregulationsstörung, Appetitveränderung, Unverträglichkeit von Stress",
  },
  {
    key: "immunologisch",
    label: "Immunologisch",
    beispiele: "z.B. wiederkehrende grippeähnliche Symptome, neue Empfindlichkeiten, Halsschmerzen",
  },
] as const;

export interface Stage1Answers {
  infektionZeitpunkt: string;
  nachweisart: "pcr" | "schnelltest" | "antikoerper" | "vermutet" | null;
  akutverlauf: "ambulant" | "normalstation" | "intensiv" | null;
  beruf: string;
  beruflicherKontakt: "ja" | "nein" | "unsicher" | null;
  bkMeldung: "ja" | "nein" | "unsicher" | null;
  beschwerdebeginnWochen: string;
  verlaufSeither: "durchgehend" | "phasenweise" | "neu" | null;
  gesamttendenz: "gebessert" | "gleich" | "verschlechtert" | null;
  symptome: SymptomKey[];
  symptomeAndere: string;
  vorerkrankungen: VorerkrankungKey[];
}

export function emptyStage1Answers(): Stage1Answers {
  return {
    infektionZeitpunkt: "",
    nachweisart: null,
    akutverlauf: null,
    beruf: "",
    beruflicherKontakt: null,
    bkMeldung: null,
    beschwerdebeginnWochen: "",
    verlaufSeither: null,
    gesamttendenz: null,
    symptome: [],
    symptomeAndere: "",
    vorerkrankungen: [],
  };
}

// null = übersprungen (bewusst vom Skip-Button gesetzt), "" = noch nicht
// beantwortet/im Eingabefeld leer. Der Unterschied wird beim Serialisieren
// gebraucht, um "übersprungen" korrekt statt als "keine Angabe" zu labeln
// (siehe lib/serializeAnswers.ts).
export type Skippable = string | null;

export interface JaNeinDetail {
  ja: boolean;
  detail: string;
}

export interface VorerkrankungDetail {
  behandelt: "ja" | "nein" | "unauffaellig" | null;
  verschlechtert: "ja" | "nein" | "unsicher" | null;
}

export interface Stage2Answers {
  // Fatigue/PEM
  belastungsartBeispiel: Skippable;
  latenz: "sofort" | "stunden" | "folgetag" | "variiert" | null;
  dauer: "unter14h" | "ab14h" | "variiert" | "weissNicht" | null;
  schlafErholsam: "ja" | "nein" | "teilweise" | null;
  tagebuch: "ja" | "nein" | null;

  // Kognitiv
  kognitivAlltagUndTestung: Skippable;
  belastungsschwelle: "kurz" | "laenger" | null;

  // Riech/Schmeck
  riechSchmeck: Skippable;
  beruflicheAbhaengigkeitSinne: JaNeinDetail | null;

  // Kreislauf/PoTS
  potsSymptome: "ja" | "nein" | null;
  stehtest: Skippable;
  hautbiopsie: Skippable;

  // Herz-Kreislauf
  herzSymptome: string[];
  troponin: Skippable;
  spiroergometrie: Skippable;

  // Atemwege
  atemwege: Skippable;

  // Psyche
  psycheVorbestehend: "ja" | "nein" | "unsicher" | null;
  andereEreignisse: JaNeinDetail | null;
  ptbsHinweise: "ja" | "nein" | "unsicher" | null; // nur falls Stage1.akutverlauf === "intensiv"

  // ME/CFS-Doppelprüfung
  aktivitaetseinschraenkung6mon: "ja" | "nein" | null;
  cccSymptome: string[]; // gewählte Symptome je CCC-Kategorie, Format "kategorie:label"

  // Vorschäden & Verlauf
  vorerkrankungenDetail: Partial<Record<VorerkrankungKey, VorerkrankungDetail>>;
  rehaUndArbeitsfaehigkeit: Skippable;
}

export function emptyStage2Answers(): Stage2Answers {
  return {
    belastungsartBeispiel: "",
    latenz: null,
    dauer: null,
    schlafErholsam: null,
    tagebuch: null,
    kognitivAlltagUndTestung: "",
    belastungsschwelle: null,
    riechSchmeck: "",
    beruflicheAbhaengigkeitSinne: null,
    potsSymptome: null,
    stehtest: "",
    hautbiopsie: "",
    herzSymptome: [],
    troponin: "",
    spiroergometrie: "",
    atemwege: "",
    psycheVorbestehend: null,
    andereEreignisse: null,
    ptbsHinweise: null,
    aktivitaetseinschraenkung6mon: null,
    cccSymptome: [],
    vorerkrankungenDetail: {},
    rehaUndArbeitsfaehigkeit: "",
  };
}
