// Typen für die regelbasierte Ersteinschätzung (Tier 1).
// Bewusst vollständig getrennt von lib/chat.ts (Tier 2, LLM-gestützt) - hier
// läuft NICHTS über die Anthropic-API. Jede Frage/Option ist ein fester,
// im Code definierter Wert; die Auswertung ist eine reine Funktion.

export type QuestionId =
  | "pem"
  | "pemTriggerart"
  | "pemAusloeseschwelle"
  | "pemLatenz"
  | "pemErholung"
  | "dauer"
  | "schmerz"
  | "schmerzausbreitung"
  | "schmerzschwere"
  | "kognitiv"
  | "autonom"
  | "autonomHfDokumentiert"
  | "schlaf"
  | "paraesthesien"
  | "atembeschwerden"
  | "diabetesStatus"
  | "psychKomorbid"
  | "medikation"
  | "medikationWirkung"
  | "bellScore"
  | "alltagsverrichtungen"
  | "arbeitsfaehigkeit"
  | "objektiveTests"
  | "funcapScore"
  | "beruflicherKontext";

export interface ChoiceOption {
  value: string;
  label: string;
}

export interface Question {
  id: QuestionId;
  /** Wird nur gestellt, wenn diese Funktion (angewandt auf die bisherigen Antworten) true liefert. */
  showIf?: (answers: Answers) => boolean;
  prompt: string;
  hint?: string;
  /** Optionaler klickbarer Link direkt unter dem Hint (z.B. zu einem externen
   *  Selbsttest-Tool) - der Hint-Text selbst wird als reiner String gerendert
   *  (kein Markdown/HTML), daher dieser separate, strukturierte Weg für einen
   *  echten <a>-Link statt einer nur sichtbaren, aber nicht klickbaren URL. */
  hintLink?: { url: string; label: string };
  /** "number" = freies Zahlenfeld statt Auswahlbuttons (siehe TriageFlow.tsx) -
   *  nur für echte, feingranulare Zahlenangaben. Für Werte, die (wie der
   *  Bell-Score) nur auf einer festen, kleinen Stufenskala definiert sind,
   *  "single" mit den Stufen als Optionen verwenden statt "number" - ein
   *  Freitextfeld würde sonst Werte erlauben, die die Skala gar nicht kennt. */
  type: "single" | "multi" | "number";
  options: ChoiceOption[];
  /** Bei Mehrfachauswahl: Wert, der sich mit allen anderen gegenseitig
   *  ausschließt (z.B. "keine davon" oder "unauffällig"). Default: "keine". */
  exclusiveValue?: string;
  /** Nur für type "number": Platzhaltertext im Eingabefeld. */
  placeholder?: string;
  /** Nur für type "number": Grenzen für die Eingabevalidierung im UI. */
  min?: number;
  max?: number;
  /** Zeigt einen "Weiß ich nicht"-Button, der die Frage ohne Wert überspringt
   *  (Answers[id] wird dann "" statt eines echten Werts) - für "number" und
   *  "single" nutzbar. */
  optional?: boolean;
}

export type Answers = Partial<Record<QuestionId, string | string[]>>;

export interface TriageResult {
  cccErfuellt: "ja" | "teilweise" | "nein" | "unklar";
  cccDetail: string[];
  iomErfuellt: "ja" | "teilweise" | "nein" | "unklar";
  iomDetail: string[];
  gdbSpanneVon: number;
  gdbSpanneBis: number;
  gdbBegruendung: string[];
  mdeEinschlaegig: boolean;
  mdeGrund: string;
  /** Nur gesetzt, wenn mdeEinschlaegig - grobe Krosswalk-Spanne, keine 1:1-Übernahme der GdB-Spanne. */
  mdeSpanneVon?: number;
  mdeSpanneBis?: number;
  mdeBegruendung: string[];
  emrKategorie: "keine" | "teilweise" | "voll" | "nicht_erhoben";
  emrBegruendung: string;
  dauerErfuellt: boolean;
  offenePunkte: string[];
  /** Grober Komplexitäts-Hinweis, steuert den Tier-2-Teaser-Text. */
  empfehlungDetailanalyse: boolean;
  /** Einfache Widerspruchsprüfung zwischen einzelnen Antworten (z. B.
   *  "weitgehend bettlägerig" bei gleichzeitig angegebener voller
   *  Arbeitsfähigkeit) - kein Vorwurf, nur ein Hinweis für die Detailanalyse. */
  inkonsistenzen: string[];
}
