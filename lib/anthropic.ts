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
  maxTokens: number
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY ist auf dem Server nicht gesetzt (Vercel Environment Variables)."
    );
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
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
