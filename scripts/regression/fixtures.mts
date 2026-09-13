// Testfälle für scripts/regression-test.mts, aus build/testfaelle.md als
// strukturierte Fixtures übernommen statt Freitext-Dokumentation - siehe
// build/effizienz-plan.md Abschnitt 5 ("Stufe 1: deterministische
// Struktur-Checks" + "Stufe 2: inhaltliche Erkennung"). Diese Datei bleibt
// bewusst reine Daten, keine Logik.

/** Stufe 2: ein Stichwort-/Themen-Check gegen den Antworttext. */
export interface TopicCheck {
  pattern: RegExp;
  label: string;
}

export interface ChatFixture {
  id: string;
  arm: "chat";
  /** Passiert der Diagnose-Gate am Anfang jedes Interviews (siehe app/page.tsx). */
  diagnosisConfirmed: boolean;
  /**
   * Vorformulierte Nutzer-Antworten, der Reihe nach als eigene Turns gesendet.
   * Reicht der Vorrat nicht bis zur Auswertung, schickt der Runner
   * zusätzlich "Bitte jetzt zur Auswertung übergehen" (siehe lib/chat.ts,
   * Ausweg bei Budget-Ende/Erschöpfung).
   */
  userTurns: string[];
  /**
   * Simuliert einen bereits abgeschlossenen Tier-1-Vorlauf (siehe
   * app/page.tsx, handleTriageComplete) - Format wie answersToContextText()
   * bzw. triageResultToPromptAnchor() ihn produzieren (lib/triage/context.ts).
   * Optional; ohne das verhält sich der Testfall wie der Telegram-Arm (kein
   * Tier-1-Vorlauf).
   */
  triageContext?: string;
  triageAnchor?: string;
  /**
   * Stufe 2: Stichworte, die in KEINER Zwischenfrage (vor der finalen
   * Auswertung) mehr vorkommen dürfen, weil sie laut triageContext bereits
   * geklärt sind - prüft den "HINWEIS TIER-1-VORLAUF" aus lib/chat.ts, der
   * das Modell anweist, diese Themen nicht erneut abzufragen. Nur sinnvoll
   * zusammen mit triageContext.
   */
  forbiddenInIntermediateTurns?: TopicCheck[];
  /** Stufe 2: erwartete inhaltliche Merkmale in der finalen Auswertung. */
  expectedTopics?: TopicCheck[];
}

export interface DocFixture {
  id: string;
  arm: "doc";
  userInput: string;
  expectedTopics?: TopicCheck[];
}

export type Fixture = ChatFixture | DocFixture;

const PEM_MENTIONED: TopicCheck = { pattern: /\bPEM\b|post-?exertionell/i, label: "PEM erwähnt" };
const DAUER_MENTIONED: TopicCheck = { pattern: /monat/i, label: "Dauer/Monate erwähnt" };

export const FIXTURES: Fixture[] = [
  {
    id: "krankenschwester-bk3101-kandidat",
    arm: "chat",
    diagnosisConfirmed: true,
    // Wortlaut 1:1 aus build/testfaelle.md ("Fall: Krankenschwester,
    // beruflicher Zusammenhang (BK-3101-Kandidat)").
    userTurns: [
      "Krankenschwester, 42, Covid infekt 2022 auf der Arbeit im Krankenhaus, BG gemeldet, ein paar wochen krank, später immer wieder krank, schwindel, kopfschmerzen, schlechter schlaf, schlechte erholung, behandlung über hausarzt",
      "ja, nach starker belastung werde ich immer krank. das dauert manchmal mehrere wochen. Der Alltag ist schwierig, ich gehe abends um am wochenende kaum raus weil ich die erholung brauche, einkaufen geht manchmal, danach aber nichts mehr. nein, von der BG habe ich weiter nichts gehört.",
      "Ja, ich arbeite mit halber Stelle. mehr geht nicht. Geld ist deswegen immer knapp. von einer BK 3101 weiss ich nichts",
    ],
    expectedTopics: [
      PEM_MENTIONED,
      DAUER_MENTIONED,
      { pattern: /einschlägig/i, label: "MdE-Einschlägigkeit thematisiert (beruflicher Zusammenhang vorhanden)" },
    ],
  },
  {
    id: "physiotherapeutin-bg-anerkannt",
    arm: "doc",
    // Rekonstruiert aus build/testfaelle.md ("Fall: Physiotherapeutin,
    // BG-anerkannte Infektion + Blutdruckproblematik") - dort nur als
    // Fließtext-Zusammenfassung überliefert, hier als plausible
    // Ärzt:innen-Eingabe für den Doc-Arm formuliert.
    userInput: `Patientin, Physiotherapeutin, Tätigkeit in Geriatrie/Intensivstation.
COVID-19-Infektion 2022, Berufskrankheit bei der zuständigen BG anerkannt
(Akutinfektion). Seit über 3 Jahren durchgehend Post-exertionelle Malaise
(PEM): Verschlechterung ca. 1-2 Tage nach Belastung, Erholung dauert Wochen,
nie vollständig erholt. Erschöpfung im Alltag im Schnitt 7/10, in Schüben
9-10/10. Ausgeprägter Brain Fog (Wortfindung, Konzentration). Medikamentös
mehrfach behandlungsbedürftige Blutdruckproblematik (autonome Komponente).
Aktuell 80% Erwerbstätigkeit bei angepasster Tätigkeit. Anerkennung des
heutigen Post-COVID-Zustands als BK-3101-Unfallfolge (nicht nur der
Akutinfektion) noch offen, Verfahren läuft.`,
    expectedTopics: [
      PEM_MENTIONED,
      { pattern: /einschlägig/i, label: "MdE-Einschlägigkeit thematisiert (BG-Anerkennung vorhanden)" },
      { pattern: /leistungsvermögen|erwerbsminderung/i, label: "EMR/Leistungsvermögen thematisiert" },
    ],
  },
  {
    id: "ccc-negativ-kein-pem",
    arm: "chat",
    diagnosisConfirmed: true,
    // Neuer Fall (nicht aus build/testfaelle.md übernommen): CCC-Kriterien
    // klar NICHT erfüllt (keine PEM, keine 6 Monate, kein Berufsbezug) -
    // prüft, dass auch ein eindeutig negativer Fall trotzdem eine
    // vollständige GdB/MdE/EMR-Auswertung bekommt (siehe lib/chat.ts,
    // "IMMER ALLE DREI Einschätzungen ausgeben"), statt verkürzt oder
    // abgebrochen zu werden.
    userTurns: [
      "Bin Rentnerin, 68, seit 4 Monaten ständig erschöpft nach einer Grippe, aber nach Anstrengung wird es eigentlich nicht schlimmer am nächsten Tag, ich merke da keinen Unterschied. Schlafe schlecht, öfter Kopfschmerzen.",
      "Nein, keine Verschlechterung Tage später, das ist eigentlich immer gleich schlimm, egal ob ich mich anstrenge oder nicht. Kein Bezug zur Arbeit, bin schon länger in Rente.",
    ],
    expectedTopics: [
      PEM_MENTIONED, // auch im negativen Fall muss PEM als geprüftes/verneintes Kriterium auftauchen
      DAUER_MENTIONED,
      { pattern: /nicht einschlägig/i, label: "MdE korrekt als nicht einschlägig erkannt (kein Berufsbezug)" },
    ],
  },
  {
    id: "mit-tier1-vorlauf-keine-doppelfragen",
    arm: "chat",
    diagnosisConfirmed: true,
    // Neuer Fall: simuliert den echten Web-Chat-Ablauf NACH Tier 1 (siehe
    // app/page.tsx, handleTriageComplete) - testet zwei Dinge zugleich:
    // (a) dass triageContext/triageAnchor korrekt im Prompt ankommen und in
    // die Auswertung einfließen, (b) dass die in P0 vorgenommene Umsortierung
    // des Tier-1-Kontexts (jetzt nach der Wissensbasis statt davor, siehe
    // lib/chat.ts) das "nicht erneut abfragen"-Verhalten nicht beeinträchtigt
    // hat - genau der Punkt, der in PR #1/#2 als manuell zu prüfen markiert war.
    triageContext: `Tritt bei Ihnen nach körperlicher, geistiger oder emotionaler Belastung eine verzögerte Verschlechterung ein (Post-exertionelle Malaise, PEM)? → Ja
Wie schnell tritt die Verschlechterung nach der Belastung typischerweise ein? → Verzögert, nach 1–3 Tagen (typisch für ME/CFS)
Wie lange dauert es meist, bis Sie sich davon wieder erholt haben? → Über eine Woche
Bestehen Ihre Beeinträchtigungen schon länger als 6 Monate durchgehend? → Ja, länger als 6 Monate
Grob geschätzt: Wie viele Stunden täglich wäre irgendeine leichte Tätigkeit auf dem allgemeinen Arbeitsmarkt für Sie aktuell vorstellbar — unabhängig von Ihrem bisherigen Beruf? → 3 bis unter 6 Stunden
Bestand ein beruflicher Zusammenhang mit Ihrer Erkrankung — z. B. Ansteckung bei einer Tätigkeit im Gesundheitsdienst, in der Wohlfahrtspflege oder in einem Labor? → Nein`,
    triageAnchor: `TIER-1-VORAB-EINSCHÄTZUNG (regelbasiert berechnet, kein LLM beteiligt):
- GdB-Spanne: 50–60. Begründung: Mittelschwere Globalfunktionsstörung (Arbeitsfähigkeit 3–6 Std./Tag bzw. PEM-Erholung über eine Woche) — Analogie VersMedV 3.1.1, mittelschwere Ausprägung.
- MdE: nicht einschlägig. Kein beruflicher Zusammenhang angegeben — MdE nach SGB VII nicht einschlägig.
- EMR: teilweise Erwerbsminderung (Leistungsvermögen 3 bis unter 6 Std./Tag). Angegebenes Leistungsvermögen 3–6 Std./Tag entspräche dem Bereich der teilweisen Erwerbsminderung.

Das ist ein Kalibrierungsanker und Ausgangspunkt, KEINE bindende
Vorentscheidung: Tier 1 kennt nur die Rohantworten oben, nicht die
Detailinformationen aus der folgenden Gesprächsvertiefung. Weiche davon ab,
wenn die Gesprächsdetails das rechtfertigen — nenne dann aber explizit, warum
du von der Tier-1-Spanne abweichst.`,
    // Vertiefungsthemen laut lib/chat.ts (hasTriageContext-Variante):
    // 1. Medikation/Therapieansprechen, 2. objektive Tests, 3. Besonderheiten.
    userTurns: [
      "Ich habe Beta-Blocker gegen Herzrasen probiert, hat ein bisschen geholfen. Sonst nichts.",
      "Nein, noch keine 6-Minuten-Gehstrecke oder Handkraftmessung gemacht, nur beim Hausarzt Blut abgenommen.",
      "Keine weiteren Besonderheiten, das war's eigentlich.",
    ],
    forbiddenInIntermediateTurns: [
      { pattern: /post-exertionelle malaise/i, label: "PEM-Frage (Tier 1 bereits beantwortet)" },
      { pattern: /länger als 6 monate/i, label: "Dauer-Frage (Tier 1 bereits beantwortet)" },
      {
        pattern: /gesundheitsdienst.*infiziert|infiziert.*gesundheitsdienst/i,
        label: "Berufsbezug-Frage (Tier 1 bereits beantwortet)",
      },
    ],
    expectedTopics: [PEM_MENTIONED, DAUER_MENTIONED],
  },
  {
    id: "beruflicher-kontext-unsicher",
    arm: "doc",
    // Neuer Fall: Grenzfall laut build/effizienz-plan.md Abschnitt 5
    // ("Grenzfälle bei beruflicherKontext: 'unsicher'") - Infektionsweg
    // nicht zweifelsfrei rekonstruierbar. lib/doc.ts kennt (anders als die
    // Tier-1-Logik in lib/triage/scoring.ts) keinen expliziten
    // "unsicher"-Zweig; dieser Testfall beobachtet, wie das Modell die
    // Unschärfe in Freitext handhabt - daher nur ein weicher Themen-Check,
    // kein exakter Erwartungswert.
    userInput: `Patient, 55, Lagerarbeiter. Arbeitete während der Pandemie in einem
Betrieb mit mehreren Corona-Fällen im Kollegenkreis, genauer Infektionsweg
nicht rekonstruierbar (privater Kontakt in derselben Zeit ebenfalls möglich).
Seit 14 Monaten anhaltende Fatigue, PEM mit Verschlechterung 1-2 Tage nach
Belastung, Erholung dauert oft über eine Woche. Aktuell arbeitsunfähig.
Keine BG-Meldung erfolgt, da Zusammenhang unklar.`,
    expectedTopics: [
      PEM_MENTIONED,
      {
        pattern: /unsicher|unklar|nicht (sicher|eindeutig|zweifelsfrei|rekonstruierbar)|ungeklärt/i,
        label: "Unsicherheit beim beruflichen Zusammenhang wird aufgegriffen, nicht glattgezogen",
      },
    ],
  },
];
