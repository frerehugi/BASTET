import { createHash } from "crypto";

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

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "de-DE,de;q=0.9",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch fehlgeschlagen (${response.status}): ${url}`);
  }
  return response.text();
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
  // rehadat-literatur.de läuft hinter Myra Cloud (WAF/DDoS-Schutz), das
  // Vercels Rechenzentrums-IPs beim ersten Cron-Lauf mit 503 blockiert hat,
  // obwohl ein normaler Fetch von außerhalb 200 liefert — vermutlich
  // IP-Reputation, nicht die Header. Realistischer Browser-User-Agent
  // (siehe fetchText) verbessert die Chance, garantiert aber nichts; bei
  // dauerhaftem 503 ist diese Quelle ohne Änderung am WAF nicht zuverlässig
  // automatisierbar - fehlschlagende Läufe brechen die Pipeline nicht ab,
  // sie werden nur nicht geprüft.
  makeHashSource("rehadat", "REHADAT — Literatur/VersMedV-Umfeld", "https://www.rehadat-literatur.de/"),
];
