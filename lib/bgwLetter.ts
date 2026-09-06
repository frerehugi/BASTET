/**
 * Reine Client-Logik für den "Brief an die Berufsgenossenschaft"-Baustein
 * (Betroffenen-Arm, app/page.tsx). Bewusst ohne jeden Serverkontakt: Name/
 * Adresse/Datum verlassen nie den Browser, siehe standardbrief-bgw.md
 * ("Offene Punkte für die Umsetzung") und das bestehende No-Storage-Prinzip.
 */

const SYMPTOM_KEYWORDS = [
  "PEM",
  "Post-exertionelle Malaise",
  "Fatigue",
  "Erschöpfung",
  "Brain Fog",
  "kognitive Einschränkung",
  "kognitive Störung",
  "Konzentrationsstörung",
  "Wortfindungsstörung",
  "Belastungsintoleranz",
  "Schwindel",
  "Schlafstörung",
  "Kopfschmerz",
  "Muskelschmerz",
  "orthostatische Intoleranz",
  "Herzrasen",
  "Kurzatmigkeit",
  "Reizüberempfindlichkeit",
];

/**
 * Toleranter Check, ob die MdE-Sektion der Auswertung "Einschlägig: ja"
 * ausweist — sucht gezielt im Textabschnitt ab der MdE-Überschrift, nicht im
 * gesamten Text, damit z.B. ein "ja" im GdB-Teil nicht fälschlich zählt.
 */
export function isMdeEinschlaegig(assessmentBody: string): boolean {
  const mdeIdx = assessmentBody.search(/MdE\s*\(/i);
  if (mdeIdx === -1) return false;
  const section = assessmentBody.slice(mdeIdx, mdeIdx + 400);
  return /einschlägig\s*:?\s*\*{0,2}\s*ja\b/i.test(section);
}

const NON_HEALTH_SECTOR_SIGNALS = [
  "bauindustrie",
  "baustelle",
  "bauarbeiter",
  "fabrik",
  "industriearbeiter",
  "lkw-fahrer",
  "spedition",
  "landwirtschaft",
  "bergbau",
  "chemiefabrik",
  "metallindustrie",
  "lagerhalle",
  "produktionshalle",
];

/**
 * Grobe Sicherheitsbremse gegen eine falsche BGW-Zuordnung: BASTETs
 * Interview fragt ohnehin gezielt nach Tätigkeit im Gesundheitsdienst/
 * Pflege/Labor (siehe lib/chat.ts), daher ist eine falsche Zuordnung schon
 * strukturell unwahrscheinlich — dies fängt nur den Fall ab, dass im
 * Gespräch ausdrücklich ein klar anderer Sektor genannt wurde.
 */
export function mentionsNonHealthSector(transcriptText: string): boolean {
  const lower = transcriptText.toLowerCase();
  return NON_HEALTH_SECTOR_SIGNALS.some((signal) => lower.includes(signal));
}

export function extractSymptomKeywords(assessmentBody: string, max = 3): string[] {
  const found: string[] = [];
  for (const keyword of SYMPTOM_KEYWORDS) {
    if (found.length >= max) break;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}`, "i");
    if (pattern.test(assessmentBody)) {
      found.push(keyword);
    }
  }
  return found;
}

/**
 * Zero-padded TT.MM.JJJJ, damit der Datum-Feld-Default zum Placeholder
 * "TT.MM.JJJJ" passt — Date.toLocaleDateString("de-DE") liefert je nach
 * Browser/Node ungepolstert (z.B. "6.9.2026" statt "06.09.2026").
 */
export function formatDateDe(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

export interface LetterFields {
  name: string;
  address: string;
  date: string;
}

function extractOrtFromAddress(address: string): string {
  const lines = address
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  const last = lines[lines.length - 1];
  const match = last.match(/^\d{4,5}\s+(.+)$/);
  return match ? match[1] : last;
}

export function composeBgwLetter(fields: LetterFields, assessmentBody: string): string {
  const keywords = extractSymptomKeywords(assessmentBody);
  const symptomText = keywords.length > 0 ? keywords.join(", ") : "Fatigue, kognitive Einschränkungen";
  const ort = extractOrtFromAddress(fields.address);
  const dateline = ort ? `${ort}, den ${fields.date}` : `den ${fields.date}`;

  return `${fields.name}
${fields.address}

Berufsgenossenschaft für Gesundheitsdienst und Wohlfahrtspflege (BGW)
Hauptverwaltung
Pappelallee 33/35/37
22089 Hamburg

${dateline}

Betreff: Post-COVID-Syndrom nach beruflich bedingter COVID-19-Infektion — Bitte um Einleitung weiterer Schritte

Sehr geehrte Damen und Herren,

wie Ihnen bekannt ist, habe ich im Rahmen meiner beruflichen Tätigkeit einen COVID-19-Infekt erlitten. Zudem leide ich unter anhaltenden Symptomen (u. a. ${symptomText}), die ein Post-COVID-Syndrom und damit eine Anerkennung als Berufskrankheit Nr. 3101 möglich erscheinen lassen.

Ich möchte Sie deshalb bitten, alle weiteren diagnostischen und formellen Schritte einzuleiten und zu koordinieren — insbesondere die Prüfung, ob die geschilderten Beschwerden als Folge der anerkannten beruflichen Infektion einzuordnen sind, sowie die Veranlassung einer entsprechenden fachärztlichen Begutachtung.

Meine Mitwirkungspflicht nach §§ 60 ff. SGB I habe ich hiermit vorerst erfüllt; für weitere Angaben oder Unterlagen stehe ich selbstverständlich zur Verfügung.

Vielen Dank und mit freundlichen Grüßen,

${fields.name}`;
}

export const LETTER_SEND_HINT = `So verschicken Sie diesen Brief am zuverlässigsten:

1. Post (empfohlen): am besten per Einschreiben, damit Sie einen Nachweis über den Zugang haben — das kann später wichtig werden.
2. DGUV-Serviceportal (serviceportal-uv.dguv.de): der von der Unfallversicherung selbst empfohlene digitale Weg.
3. E-Mail (online-redaktion@bgw-online.de): allgemeine Kontaktadresse der BGW — für den Erstkontakt nutzbar, aber möglicherweise nicht für die sichere Übermittlung sensibler Gesundheitsangaben vorgesehen.`;

export const OTHER_SECTOR_NOTICE =
  "Diese Funktion ist aktuell auf die BGW (Gesundheitsdienst/Wohlfahrtspflege) zugeschnitten. Da im Gespräch ein anderer Berufszweig genannt wurde, recherchieren Sie bitte die Kontaktdaten Ihrer zuständigen Berufsgenossenschaft selbst (Übersicht: dguv.de/de/bg-uk-lv/bgen).";
