import { createHash } from "crypto";
import https from "https";

export interface SourceCheckResult {
  changed: boolean;
  fingerprint: string;
  /** Text, das dem LLM zur Zusammenfassung übergeben wird, falls sich etwas geändert hat. */
  rawContentForSummary: string;
  detailUrl: string;
}

export interface UpdateSource {
  id: string;
  label: string;
  url: string;
  check(previousFingerprint: string | null): Promise<SourceCheckResult>;
}

const REQUEST_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "de-DE,de;q=0.9",
};

/**
 * Node/undicis globales fetch() lehnt eine vom Server verlangte
 * TLS-Renegotiation mitten im Handshake ab ("fetch failed", kein
 * HTTP-Status) — betrifft mehrere deutsche Justiz-/Behörden-Apache-Server
 * (verifiziert bei bsg.bund.de-Mirror UND gesetze-im-internet.de, 06.09.2026),
 * die curl klaglos verarbeitet. Node's klassisches https-Modul unterstützt
 * Renegotiation dagegen (OpenSSL-Bindings direkter statt über undici) — daher
 * hier bewusst https.get() statt fetch(), mit manueller Redirect-Behandlung.
 */
function fetchViaNodeHttps(url: string, redirectsLeft = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: REQUEST_HEADERS }, (res) => {
      const status = res.statusCode ?? 0;

      if (status >= 300 && status < 400 && res.headers.location && redirectsLeft > 0) {
        res.resume();
        const nextUrl = new URL(res.headers.location, url).toString();
        fetchViaNodeHttps(nextUrl, redirectsLeft - 1).then(resolve, reject);
        return;
      }

      if (status < 200 || status >= 300) {
        res.resume();
        reject(new Error(`Fetch fehlgeschlagen (${status}): ${url}`));
        return;
      }

      let data = "";
      res.setEncoding("utf-8");
      res.on("data", (chunk: string) => {
        data += chunk;
      });
      res.on("end", () => resolve(data));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

async function fetchText(url: string): Promise<string> {
  return fetchViaNodeHttps(url);
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hash-basierter Fallback-Check: fingerprint = SHA-256 des (grob von HTML
 * befreiten) Seiteninhalts. Erkennt zuverlässig JEDE Änderung, auch rein
 * kosmetische (Cookie-Banner-Text, "zuletzt besucht"-Datum etc.) - siehe
 * Einschränkung in build/claude-code-buildplan.md, Phase 4. Für die drei
 * Quellen ohne verifiziertes RSS/Datumsfeld (DGUV, AWMF, REHADAT) bewusst
 * gewählt statt einer geratenen, möglicherweise falschen Selektor-Logik.
 */
function makeHashSource(id: string, label: string, url: string): UpdateSource {
  return {
    id,
    label,
    url,
    async check(previousFingerprint) {
      const html = await fetchText(url);
      const text = stripHtml(html);
      const fingerprint = sha256(text);
      return {
        changed: previousFingerprint !== null && fingerprint !== previousFingerprint,
        fingerprint,
        rawContentForSummary: text.slice(0, 6000),
        detailUrl: url,
      };
    },
  };
}

interface RssItem {
  title: string;
  link: string;
  guid: string;
  pubDate: string;
  description: string;
}

function parseFirstRssItem(xml: string): RssItem | null {
  const itemMatch = xml.match(/<item>([\s\S]*?)<\/item>/i);
  if (!itemMatch) return null;
  const block = itemMatch[1];
  const field = (tag: string): string => {
    const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (!m) return "";
    return m[1]
      .replace(/^<!\[CDATA\[/, "")
      .replace(/\]\]>$/, "")
      .trim();
  };
  return {
    title: field("title"),
    link: field("link"),
    guid: field("guid") || field("link"),
    pubDate: field("pubDate"),
    description: stripHtml(field("description")),
  };
}

/**
 * RSS-basierter Check für die Bundessozialgericht-Entscheidungen. Der Feed
 * auf rechtsprechung-im-internet.de (juris.de-Infrastruktur) verlangt eine
 * TLS-Renegotiation mitten im Handshake, die Node/undici (Vercel-Laufzeit)
 * mit einem generischen "fetch failed" ablehnt, obwohl klassisches curl damit
 * klarkommt — deshalb bewusst der eigene bsg.bund.de-Feed statt des Mirrors,
 * verifiziert per direktem Fetch (06.09.2026). fingerprint = guid/link der
 * neuesten Entscheidung.
 */
const bsgSource: UpdateSource = {
  id: "bsg",
  label: "Bundessozialgericht (BSG) — neue Entscheidungen",
  url: "https://www.bsg.bund.de/DE/Service/RSS-Feed/_functions/rssnewsfeed-entscheidungen.xml",
  async check(previousFingerprint) {
    const xml = await fetchText(this.url);
    const item = parseFirstRssItem(xml);
    if (!item) {
      throw new Error("BSG-RSS-Feed konnte nicht geparst werden (kein <item> gefunden).");
    }
    const fingerprint = item.guid;
    return {
      changed: previousFingerprint !== null && fingerprint !== previousFingerprint,
      fingerprint,
      rawContentForSummary: `${item.title}\n${item.pubDate}\n${item.description}`,
      detailUrl: item.link || this.url,
    };
  },
};

export const UPDATE_SOURCES: UpdateSource[] = [
  bsgSource,
  makeHashSource(
    "sozialgerichtsbarkeit",
    "sozialgerichtsbarkeit.de — Suche \"Post-COVID\"",
    "https://www.sozialgerichtsbarkeit.de/suche/?q=Post-COVID"
  ),
  makeHashSource(
    "dguv",
    "DGUV — Mediencenter Hintergrund (UV-Recht)",
    "https://www.dguv.de/de/mediencenter/hintergrund/index.jsp"
  ),
  makeHashSource(
    "awmf",
    "AWMF-Register — Leitlinie Long/Post-COVID (020-027)",
    "https://register.awmf.org/de/leitlinien/detail/020-027"
  ),
  // Ersetzt rehadat-literatur.de (Myra-Cloud-WAF blockierte Vercels
  // Rechenzentrums-IPs mit dauerhaftem 503, obwohl von außerhalb erreichbar —
  // vermutlich IP-Reputation, kein Header-Problem). gesetze-im-internet.de ist
  // die offizielle Gesetzestext-Quelle des BMJ selbst (verifiziert erreichbar,
  // 06.09.2026) — für VersMedV-Novellierungen ohnehin die autoritativere
  // Quelle als eine Literaturdatenbank, die nur darauf verweist.
  makeHashSource(
    "versmedv-text",
    "gesetze-im-internet.de — VersMedV (Volltext, BMJ)",
    "https://www.gesetze-im-internet.de/versmedv/"
  ),
];
