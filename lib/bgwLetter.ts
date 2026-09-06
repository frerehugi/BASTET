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

// Verneinungswörter, die VOR einem Symptom stehen können ("Kein PEM.",
// "Keine Fatigue berichtet."), und Verneinungsmuster, die dem Symptom folgen
// können ("PEM wird verneint.", "Fatigue liegt nicht vor."). Ohne diese
// Prüfung wurde reines Keyword-Matching fälschlich fündig, selbst wenn die
// Auswertung ein Symptom ausdrücklich ausschließt (siehe externes Review,
// 06.09.2026: "Kein PEM. Keine Fatigue. Keine kognitive Störung." führte zu
// allen drei Symptomen im Brief).
const NEGATION_BEFORE = ["kein", "keine", "keinen", "keinem", "keiner", "keines", "ohne", "nicht"];
const NEGATION_AFTER =
  /^\s*(wird\s+)?(verneint|ausgeschlossen|nicht\s+vorhanden|nicht\s+vorliegend|liegt\s+nicht\s+vor|nicht\s+nachweisbar|nicht\s+erkennbar|nicht\s+angegeben|nicht\s+berichtet)\b/i;

// Kontrastwörter innerhalb desselben Satzes ("Keine Fatigue, ABER deutliche
// Konzentrationsstörung") heben eine vorher gefundene Verneinung wieder auf -
// ohne diesen Reset würde "Keine Fatigue im engeren Sinne, aber deutliche
// Konzentrationsstörung" fälschlich auch die Konzentrationsstörung als
// verneint behandeln, nur weil "keine" irgendwo früher im selben Satz steht.
const CONTRAST_WORDS = ["aber", "jedoch", "allerdings", "sondern", "wohingegen", "dennoch"];

function trimAfterLastContrast(text: string): string {
  let cutAt = -1;
  for (const word of CONTRAST_WORDS) {
    const pattern = new RegExp(`\\b${word}\\b`, "gi");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text))) {
      const end = match.index + match[0].length;
      if (end > cutAt) cutAt = end;
    }
  }
  return cutAt === -1 ? text : text.slice(cutAt);
}

/**
 * Prüft, ob eine an Position `matchIndex` beginnende Symptom-Erwähnung durch
 * ein Verneinungswort im selben Satz negiert wird - vor der Erwähnung
 * (Blick zurück bis zur letzten Satzgrenze, dann zurückgesetzt durch ein
 * eventuelles Kontrastwort wie "aber") oder direkt danach (Blick nach vorn
 * auf ein typisches Verneinungsmuster).
 */
function isNegatedMention(text: string, matchIndex: number, matchLength: number): boolean {
  const windowStart = Math.max(0, matchIndex - 80);
  let before = text.slice(windowStart, matchIndex);
  const lastBoundary = Math.max(
    before.lastIndexOf(". "),
    before.lastIndexOf("! "),
    before.lastIndexOf("? "),
    before.lastIndexOf("\n"),
    before.lastIndexOf(": ")
  );
  if (lastBoundary !== -1) before = before.slice(lastBoundary + 1);
  before = trimAfterLastContrast(before);
  const beforeNegated = NEGATION_BEFORE.some((neg) => new RegExp(`\\b${neg}\\b`, "i").test(before));
  if (beforeNegated) return true;

  const after = text.slice(matchIndex + matchLength, matchIndex + matchLength + 40);
  return NEGATION_AFTER.test(after);
}

export function extractSymptomKeywords(assessmentBody: string, max = 3): string[] {
  const found: string[] = [];
  for (const keyword of SYMPTOM_KEYWORDS) {
    if (found.length >= max) break;
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}`, "i");
    const match = pattern.exec(assessmentBody);
    if (match && !isNegatedMention(assessmentBody, match.index, match[0].length)) {
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

nach meinem eigenen Kenntnisstand habe ich mich im Rahmen meiner beruflichen Tätigkeit mit COVID-19 infiziert. Seitdem leide ich unter anhaltenden Symptomen (u. a. ${symptomText}), die ein Post-COVID-Syndrom und damit eine Anerkennung als Berufskrankheit Nr. 3101 möglich erscheinen lassen.

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
