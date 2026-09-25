// Typen für die regelbasierte Ersteinschätzung (Tier 1).
// Bewusst vollständig getrennt von lib/chat.ts (Tier 2, LLM-gestützt) - hier
// läuft NICHTS über die Anthropic-API. Jede Frage/Option ist ein fester,
// im Code definierter Wert; die Auswertung ist eine reine Funktion.

export type QuestionId =
  | "pem"
  | "pemAusloeseschwelle"
  | "pemLatenz"
  | "pemErholung"
  | "dauer"
  | "schmerz"
  | "schmerzschwere"
  | "kognitiv"
  | "autonom"
  | "autonomHfDokumentiert"
  | "schlaf"
  | "psychKomorbid"
  | "bellScore"
  | "alltagsverrichtungen"
  | "arbeitsfaehigkeit"
  | "objektiveTests"
  | "beruflicherKontext"
  | "bk3101Status";

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
  /** "number" = freies Zahlenfeld statt Auswahlbuttons (siehe TriageFlow.tsx),
   *  bislang nur für "bellScore" genutzt. */
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
  /** Nur für type "number": zeigt einen "Weiß ich nicht"-Button, der die
   *  Frage ohne Wert überspringt (Answers[id] wird dann "" statt einer Zahl). */
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
}
