const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-5";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  error?: { message?: string; type?: string };
  stop_reason?: string;
}

export async function callClaude(
  system: string,
  messages: ChatMessage[],
  maxTokens: number,
  enableWebSearch: boolean = false
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY ist auf dem Server nicht gesetzt (Vercel Environment Variables)."
    );
  }

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages,
  };

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
