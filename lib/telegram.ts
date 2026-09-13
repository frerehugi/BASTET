const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

// Telegram lehnt Nachrichten über 4096 Zeichen ab. Sicherheitsabstand für
// mehrsprachige/UTF-8-Zeichen und um nie exakt an der Grenze zu landen.
const TELEGRAM_MAX_LENGTH = 3800;

function splitForTelegram(text: string): string[] {
  if (text.length <= TELEGRAM_MAX_LENGTH) return [text];

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > TELEGRAM_MAX_LENGTH) {
    let splitAt = rest.lastIndexOf("\n\n", TELEGRAM_MAX_LENGTH);
    if (splitAt < TELEGRAM_MAX_LENGTH * 0.5) {
      splitAt = rest.lastIndexOf("\n", TELEGRAM_MAX_LENGTH);
    }
    if (splitAt < TELEGRAM_MAX_LENGTH * 0.5) {
      splitAt = TELEGRAM_MAX_LENGTH;
    }
    chunks.push(rest.slice(0, splitAt).trim());
    rest = rest.slice(splitAt).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

async function sendOne(token: string, chatId: number, text: string): Promise<void> {
  const response = await fetch(`${TELEGRAM_API_BASE}${token}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Telegram sendMessage fehlgeschlagen: HTTP ${response.status} ${detail}`);
  }
}

/**
 * Sendet Text an einen Telegram-Chat. Nachrichten über Telegrams 4096-Zeichen-
 * Limit werden an Absatzgrenzen in mehrere Nachrichten aufgeteilt und
 * nacheinander (in Reihenfolge) verschickt.
 */
export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN ist auf dem Server nicht gesetzt (Vercel Environment Variables).");
  }
  for (const chunk of splitForTelegram(text)) {
    await sendOne(token, chatId, chunk);
  }
}

/**
 * Telegrams "tippt…"-Indikator, siehe startTypingIndicator() unten. Bewusst
 * best-effort/still fehlschlagend (kein throw) - das ist eine reine
 * UX-Geste, die die eigentliche Antwort niemals verzögern oder verhindern
 * darf (siehe build/effizienz-plan.md Abschnitt 3: Telegram kann nicht
 * wie der Web-Chat-Arm streamen, der Tipp-Indikator ist der pragmatische
 * Ersatz dafür - "es tut sich was" statt stillem Warten bei Brain Fog).
 */
async function sendTelegramChatAction(chatId: number): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    await fetch(`${TELEGRAM_API_BASE}${token}/sendChatAction`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    });
  } catch {
    // best-effort - ein Fehlschlag hier darf den eigentlichen Anthropic-Call
    // (der parallel läuft, siehe app/api/telegram/route.ts) nicht anfassen.
  }
}

/**
 * Hält "tippt…" während einer länger laufenden Operation (dem Anthropic-
 * Call) am Leben - Telegram zeigt den Indikator nur für ca. 5 Sekunden,
 * danach muss er erneut gesendet werden. Aufrufer MUSS die zurückgegebene
 * Stop-Funktion in einem finally aufrufen, sonst läuft der Intervall-Timer
 * über das Ende des Requests hinaus weiter.
 */
export function startTypingIndicator(chatId: number): () => void {
  void sendTelegramChatAction(chatId);
  const interval = setInterval(() => {
    void sendTelegramChatAction(chatId);
  }, 4000);
  return () => clearInterval(interval);
}
