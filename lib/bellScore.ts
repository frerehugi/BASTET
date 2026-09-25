// Deutsche Fassung des Bell-Score (Charité Fatigue Centrum) - geteilt zwischen
// dem Doc-Arm (app/doc/page.tsx, Freitextfeld "Bell-Score, falls erhoben") und
// der Tier-1-Triage (app/TriageFlow.tsx, Frage "bellScore"), damit die Tabelle
// nicht zweimal gepflegt werden muss. Reine Referenzanzeige, keine Auswahl.
// Quelle: David S. Bell, "The Doctor's Guide to Chronic Fatigue Syndrome",
// S. 122 f., Addison-Wesley Publishing Company, Reading, MA; deutsche Fassung
// Charité Fatigue Centrum, Bell-Score 1995.
export interface BellScoreRow {
  score: number;
  text: string;
}

export const BELL_SCORE_SOURCE_URL = "https://www.mecfs.de/wp-content/uploads/2025/07/Bell-Score-Charite.pdf";

export const BELL_SCORE_DE: BellScoreRow[] = [
  {
    score: 100,
    text: "Keine Symptome in Ruhe; keine Symptome in Ruhe und bei körperlicher Belastung; insgesamt ein normales Aktivitätsniveau; ohne Schwierigkeiten in der Lage, Vollzeit zu arbeiten",
  },
  {
    score: 90,
    text: "Keine Symptome in Ruhe; leichte Symptome bei körperlicher und geistiger Belastung; insgesamt ein normales Aktivitätsniveau; ohne Schwierigkeiten in der Lage, Vollzeit zu arbeiten",
  },
  {
    score: 80,
    text: "Leichte Symptome in Ruhe; die Symptome verstärken sich durch Belastung; nur bei Tätigkeiten, die anstrengend sind, ist eine geringfügige Leistungseinschränkung spürbar; mit Schwierigkeiten in der Lage, an Arbeitsplätzen, die Kraftanstrengungen erfordern, Vollzeit zu arbeiten",
  },
  {
    score: 70,
    text: "Leichte Symptome in Ruhe; deutliche Begrenzungen in den täglichen Aktivitäten spürbar; der funktionelle Zustand beträgt insgesamt etwa 90 % der Norm – mit Ausnahme von Tätigkeiten, die einer Kraftanstrengung bedürfen; mit Schwierigkeiten in der Lage, Vollzeit zu arbeiten",
  },
  {
    score: 60,
    text: "Leichte Symptome in Ruhe; deutliche Begrenzungen in den täglichen Aktivitäten spürbar; der funktionelle Zustand beträgt insgesamt etwa 70–90 % der Norm; unfähig, einer Vollzeitbeschäftigung nachzugehen, wenn dort körperliche Arbeit gefordert wird; aber in der Lage, Vollzeit zu arbeiten, wenn es um leichte Arbeiten geht und die Arbeitszeit flexibel gehandhabt werden kann",
  },
  {
    score: 50,
    text: "Mittelschwere Symptome in Ruhe; mittelschwere bis schwere Symptome bei körperlicher Belastung oder Aktivität; der funktionelle Zustand ist auf 70 % der Norm reduziert; unfähig, anstrengende Arbeiten durchzuführen, aber in der Lage, leichte Arbeiten oder Schreibtischarbeit für 4–5 Stunden täglich durchzuführen, wobei Ruhepausen benötigt werden",
  },
  {
    score: 40,
    text: "Mittelschwere Symptome in Ruhe; mittelschwere bis schwere Symptome bei Belastung oder Aktivität; der funktionelle Zustand ist auf 50–70 % der Norm reduziert; unfähig, anstrengende Arbeiten durchzuführen, aber in der Lage, leichte Arbeiten oder Schreibtischarbeit für 3–4 Stunden täglich durchzuführen, wobei Ruhepausen benötigt werden",
  },
  {
    score: 30,
    text: "Mittelschwere bis schwere Symptome in Ruhe; schwere Symptome bei jeglicher Belastung oder Aktivität; der funktionelle Zustand ist auf 50 % der Norm reduziert; in der Regel ans Haus gefesselt; unfähig, anstrengende Arbeiten durchzuführen, aber in der Lage, leichte Arbeiten oder Schreibtischarbeit für 2–3 Stunden täglich durchzuführen, wobei Ruhepausen benötigt werden",
  },
  {
    score: 20,
    text: "Mittelschwere bis schwere Symptome in Ruhe; schwere Symptome bei jeglicher Belastung oder Aktivität; der funktionelle Zustand ist auf 30–50 % der Norm reduziert; bis auf seltene Ausnahmen unfähig, das Haus zu verlassen; den größten Teil des Tages ans Bett gefesselt; unfähig, sich mehr als eine Stunde am Tag zu konzentrieren",
  },
  {
    score: 10,
    text: "Schwere Symptome in Ruhe; die meiste Zeit bettlägerig; ein Verlassen des Hauses ist nicht möglich; deutliche kognitive Symptome, die eine Konzentration verhindern",
  },
  {
    score: 0,
    text: "Ständig schwere Symptome; immer ans Bett gefesselt; unfähig zu einfachsten Pflegemaßnahmen",
  },
];
