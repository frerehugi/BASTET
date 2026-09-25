const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

// Ein einzelner Inhaltsblock innerhalb einer Nachricht - neben reinem Text
// auch Bilder und Dokumente (PDF), siehe lib/doc.ts (Datei-Upload im
// Ärzte-Arm "weitere Befunde"). base64 ohne "data:..."-Prefix, media_type
// separat (Anthropic-API-Konvention).
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } };

export interface ChatMessage {
  role: "user" | "assistant";
  // string bleibt der Normalfall (Web-Chat, Telegram, BG-Hilfe) - ContentBlock[]
  // nur dort, wo tatsächlich Bilder/Dokumente mitgeschickt werden (Doc-Arm).
  content: string | ContentBlock[];
}

// Ein System-Prompt-Block mit optionalem Cache-Breakpoint. `system` kann
// entweder ein einzelner String sein (kein Caching, Legacy-Pfad) oder ein
// Array solcher Blöcke - siehe lib/chat.ts/lib/doc.ts für die
// statisch/dynamisch-Aufteilung, die das Caching erst wirksam macht
// (Reihenfolge: stabile Blöcke mit cache_control zuerst, variable Inhalte
// zuletzt und ohne Marker, siehe build/effizienz-plan.md Abschnitt 1).
export interface SystemTextBlock {
  type: "text";
  text: string;
  cache_control?: { type: "ephemeral"; ttl?: "5m" | "1h" };
}

export type SystemPrompt = string | SystemTextBlock[];

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

// Von Anthropic auf jeder Antwort mitgeliefert, bislang aber nirgends
// ausgelesen - ohne das gab es keine Sichtbarkeit, ob Prompt Caching
// tatsächlich greift (cache_read_input_tokens sollte bei warmem Cache
// deutlich über input_tokens liegen) oder wie teuer eine Anfrage wirklich
// war. Siehe logUsage() unten (Kosteneffizienz-Review).
interface UsageInfo {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  error?: { message?: string; type?: string };
  stop_reason?: string;
  usage?: UsageInfo;
}

/**
 * Reines Server-Log (Vercel Logs), kein Redis/keine Persistenz - anders als
 * lib/userCount.ts geht es hier nicht um eine dauerhaft abrufbare Kennzahl,
 * sondern um die Möglichkeit, im Log nach Cache-Trefferquote/Tokenmengen zu
 * suchen, wenn die tatsächlichen Kosten unklar sind (z.B. cache_read_input_tokens
 * über mehrere Anfragen hinweg mit input_tokens vergleichen). `context`
 * identifiziert grob die Aufrufstelle (z.B. "callClaude"/"streamClaude"),
 * ohne dass lib/anthropic.ts wissen muss, welcher Arm/Modus aufgerufen hat.
 */
function logUsage(context: string, usage: UsageInfo | undefined): void {
  if (!usage) return;
  console.log(
    `[anthropic:usage] ${context} input=${usage.input_tokens ?? 0} ` +
      `cache_write=${usage.cache_creation_input_tokens ?? 0} ` +
      `cache_read=${usage.cache_read_input_tokens ?? 0} ` +
      `output=${usage.output_tokens ?? 0}`
  );
}

function getApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY ist auf dem Server nicht gesetzt (Vercel Environment Variables)."
    );
  }
  return apiKey;
}

function buildRequestBody(
  system: SystemPrompt,
  messages: ChatMessage[],
  maxTokens: number,
  enableWebSearch: boolean,
  cacheMessages: boolean,
  stream: boolean
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  };

  if (stream) {
    body.stream = true;
  }

  if (cacheMessages) {
    // Automatischer Top-Level-Breakpoint auf den letzten cachefähigen Block
    // der wachsenden `messages`-Historie (Multi-Turn-Interview) - ergänzt die
    // expliziten Breakpoints auf den statischen system-Blöcken (Regeln,
    // Wissensbasis), siehe lib/chat.ts. Nur für den mehrstufigen Interview-
    // Arm sinnvoll; beim Einzelaufruf (lib/doc.ts) gäbe es nichts, das ein
    // zweites Mal gelesen würde, nur unnötige Schreibkosten.
    body.cache_control = { type: "ephemeral", ttl: "1h" };
  }

  if (enableWebSearch) {
    // max_uses begrenzt die Recherchekosten pro Anfrage - die Wissensbasis
    // deckt den Regelfall ab, web_search soll gezielt ergänzen (aktuellere
    // Urteile/Normfassungen), nicht die komplette Recherche neu aufrollen.
    // Bewusst web_search_20250305 (Basis-Suche): web_search_20260209+ routet
    // per Dynamic Filtering standardmäßig über Code-Execution (anderer
    // allowed_callers-Default) - Mehrwert nur bei suchintensiven Workflows,
    // nicht bei dieser knapp gedeckelten Ergänzungsrecherche, und ein reiner
    // Versionswechsel wäre keine risikolose Änderung (siehe offizielle Doku
    // platform.claude.com/docs/.../web-search-tool).
    body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  }

  return body;
}

export async function callClaude(
  system: SystemPrompt,
  messages: ChatMessage[],
  maxTokens: number,
  enableWebSearch: boolean = false,
  cacheMessages: boolean = false
): Promise<string> {
  const apiKey = getApiKey();
  const body = buildRequestBody(system, messages, maxTokens, enableWebSearch, cacheMessages, false);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as AnthropicResponse;

  if (!response.ok || data.error) {
    const detail = data.error?.message || data.error?.type || `HTTP ${response.status}`;
    throw new Error(detail);
  }

  logUsage("callClaude", data.usage);

  const text = (data.content || [])
    .filter((block) => block.type === "text")
    .map((block) => block.text || "")
    .join("\n");

  if (!text) {
    throw new Error("Antwort war leer (evtl. nur Tool-Aufruf ohne Text).");
  }

  // Eine bei max_tokens abgeschnittene Auswertung (mitten im Satz, evtl. vor
  // dem REFERENZEN-Block) sieht auf den ersten Blick vollständig aus, ist es
  // aber nicht - das darf nie stillschweigend als Erfolg durchgehen. Lieber
  // laut scheitern (Retry-Mechanismus in allen drei Armen fängt das ab) als
  // eine unvollständige medizinisch-rechtliche Einschätzung ausliefern.
  if (data.stop_reason === "max_tokens") {
    throw new Error(
      `Antwort wurde bei ${maxTokens} Tokens abgeschnitten (stop_reason: max_tokens) statt vollständig zu enden.`
    );
  }

  return text;
}

interface StreamDelta {
  type?: string;
  text?: string;
  stop_reason?: string | null;
}

interface StreamEvent {
  type: string;
  delta?: StreamDelta;
  content_block?: { type?: string };
  error?: { message?: string; type?: string };
  // message_start trägt die initiale usage (input_tokens, cache_creation_/
  // cache_read_input_tokens); message_delta trägt am Stream-Ende die
  // kumulierte usage.output_tokens - beide zusammen ergeben logUsage()s
  // vollständiges Bild, siehe streamClaude() unten.
  message?: { usage?: UsageInfo };
  usage?: UsageInfo;
}

/**
 * Streaming-Variante von callClaude() für den Web-Chat-Arm (siehe
 * app/api/chat/route.ts) - liefert Text inkrementell statt erst nach
 * vollständiger Generierung, wichtig für die Zielgruppe (Brain Fog, Warten
 * ohne Rückmeldung ist besonders belastend, siehe build/effizienz-plan.md
 * Abschnitt 3). lib/doc.ts und der Telegram-Arm (Telegram kann nicht
 * streamen) bleiben bewusst bei callClaude().
 *
 * Wirft wie callClaude() bei einem Fehler VOR dem ersten Chunk (fehlender
 * API-Key, HTTP-Fehler vor Stream-Start). Ein Fehler MITTEN im Stream (z.B.
 * stop_reason: max_tokens, erst nach dem letzten Chunk bekannt, oder ein
 * Verbindungsabbruch) kann nicht mehr als Exception vor dem ersten Chunk
 * geworfen werden - der Aufrufer MUSS daher nach Ende der Iteration prüfen,
 * ob die Generator-Rückgabe (bei `for await` über `.return()`s Ergebnis nicht
 * sichtbar) einen Fehler enthielt; siehe app/api/chat/route.ts, das dafür statt
 * dessen einen Marker (lib/streamProtocol.ts) ans Stream-Ende schreibt.
 */
export async function* streamClaude(
  system: SystemPrompt,
  messages: ChatMessage[],
  maxTokens: number,
  enableWebSearch: boolean = false,
  cacheMessages: boolean = false
): AsyncGenerator<string, void, unknown> {
  const apiKey = getApiKey();
  const body = buildRequestBody(system, messages, maxTokens, enableWebSearch, cacheMessages, true);

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      accept: "text/event-stream",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    // Ein Fehler VOR Stream-Start (z.B. 400/401) liefert normales JSON, kein
    // SSE - gleiche Fehlerbehandlung wie callClaude().
    let detail = `HTTP ${response.status}`;
    try {
      const data = (await response.json()) as AnthropicResponse;
      detail = data.error?.message || data.error?.type || detail;
    } catch {
      // Body war kein JSON (z.B. leer) - bei der HTTP-Statuscode-Meldung bleiben.
    }
    throw new Error(detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let stopReason: string | null | undefined;
  let midStreamError: string | null = null;
  let textBlocksSeen = 0;
  let anyTextEmitted = false;
  // usage kommt über zwei SSE-Events verteilt (siehe StreamEvent oben) -
  // message_start liefert input/cache_write/cache_read, message_delta am
  // Ende die kumulierten output_tokens. Letzterer Wert überschreibt sich bei
  // mehreren message_delta-Events immer mit dem jeweils neuesten Stand.
  let usage: UsageInfo = {};

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // letzte, evtl. unvollständige Zeile zurückstellen

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        let event: StreamEvent;
        try {
          event = JSON.parse(jsonStr) as StreamEvent;
        } catch {
          continue; // unvollständige/kaputte Zeile - überspringen statt abzubrechen
        }

        if (event.type === "content_block_start" && event.content_block?.type === "text") {
          textBlocksSeen += 1;
          // Entspricht dem `.join("\n")` in callClaude() zwischen mehreren
          // Text-Blöcken (z.B. Text vor/nach einem web_search-Tool-Aufruf).
          if (textBlocksSeen > 1) yield "\n";
        } else if (event.type === "content_block_delta" && event.delta?.type === "text_delta" && event.delta.text) {
          anyTextEmitted = true;
          yield event.delta.text;
        } else if (event.type === "message_start" && event.message?.usage) {
          usage = { ...usage, ...event.message.usage };
        } else if (event.type === "message_delta" && event.delta?.stop_reason !== undefined) {
          stopReason = event.delta.stop_reason;
          if (event.usage) usage = { ...usage, ...event.usage };
        } else if (event.type === "error") {
          midStreamError = event.error?.message ?? event.error?.type ?? "Unbekannter Stream-Fehler.";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Auch bei einem anschließenden Fehler (max_tokens, midStreamError) loggen -
  // die Tokens wurden so oder so verbraucht, und gerade eine abgeschnittene
  // Antwort ist für die Kosteneinordnung relevant.
  logUsage("streamClaude", usage);

  if (midStreamError) {
    throw new Error(midStreamError);
  }
  if (!anyTextEmitted) {
    throw new Error("Antwort war leer (evtl. nur Tool-Aufruf ohne Text).");
  }
  // Gleiche harte Absicherung wie callClaude() (siehe dortigen Kommentar) -
  // hier zwangsläufig erst NACH dem letzten Chunk feststellbar.
  if (stopReason === "max_tokens") {
    throw new Error(
      `Antwort wurde bei ${maxTokens} Tokens abgeschnitten (stop_reason: max_tokens) statt vollständig zu enden.`
    );
  }
}
