// Testfälle für scripts/regression-test.ts, aus build/testfaelle.md als
// strukturierte Fixtures übernommen statt Freitext-Dokumentation - siehe
// build/effizienz-plan.md Abschnitt 5 ("Stufe 1: deterministische
// Struktur-Checks"). Diese Datei bleibt bewusst reine Daten, keine Logik.

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
}

export interface DocFixture {
  id: string;
  arm: "doc";
  userInput: string;
}

export type Fixture = ChatFixture | DocFixture;

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
  },
];
