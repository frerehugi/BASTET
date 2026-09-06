import { sendTelegramMessage } from "./telegram";
import { approvePendingItem, getPendingItems, rejectPendingItem, type PendingItem } from "./reviewQueue";

/**
 * Proaktive Benachrichtigung vom Cron-Check (siehe app/api/cron/check-updates)
 * an die Admin-chat_id. Kein Fehler, falls TELEGRAM_ADMIN_CHAT_ID nicht
 * gesetzt ist — der Cron-Lauf soll dadurch nicht scheitern, nur die
 * Benachrichtigung entfällt (Fund bleibt trotzdem in der Review-Queue).
 */
export async function notifyAdminOfPendingItem(item: PendingItem): Promise<void> {
  const adminChatId = getAdminChatId();
  if (adminChatId === null) {
    console.warn("TELEGRAM_ADMIN_CHAT_ID nicht gesetzt — Update-Fund nicht benachrichtigt:", item.id);
    return;
  }
  await sendTelegramMessage(
    adminChatId,
    `🔎 Neue Wissensbasis-Aktualisierung zur Prüfung\n\n${formatPendingItem(item, 0)}\n\nFreigeben: "freigeben ${item.id}" · Ablehnen: "ablehnen ${item.id} [Grund]"`
  );
}

function getAdminChatId(): number | null {
  const raw = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isAdminChat(chatId: number): boolean {
  const adminChatId = getAdminChatId();
  return adminChatId !== null && chatId === adminChatId;
}

function formatPendingItem(item: PendingItem, index: number): string {
  const date = new Date(item.detectedAt).toISOString().slice(0, 10);
  return `${index + 1}. [${item.id}] ${item.sourceLabel} (${date})\n${item.summary}\nQuelle: ${item.sourceUrl}`;
}

async function handlePendingList(chatId: number): Promise<void> {
  const items = await getPendingItems();
  if (items.length === 0) {
    await sendTelegramMessage(chatId, "Keine offenen Wissensbasis-Aktualisierungen zur Prüfung.");
    return;
  }
  const list = items.map((item, i) => formatPendingItem(item, i)).join("\n\n");
  await sendTelegramMessage(
    chatId,
    `${items.length} offene Aktualisierung(en):\n\n${list}\n\nFreigeben: "freigeben <id>" · Ablehnen: "ablehnen <id> [Grund]"`
  );
}

async function handleApprove(chatId: number, idArg: string | undefined): Promise<void> {
  const items = await getPendingItems();
  let id = idArg;
  if (!id) {
    if (items.length === 1) {
      id = items[0].id;
    } else if (items.length === 0) {
      await sendTelegramMessage(chatId, "Keine offenen Aktualisierungen zum Freigeben.");
      return;
    } else {
      await sendTelegramMessage(
        chatId,
        `Mehrere offene Aktualisierungen (${items.length}) — bitte mit ID freigeben: "freigeben <id>". /pending zeigt die Liste.`
      );
      return;
    }
  }
  const approved = await approvePendingItem(id);
  if (!approved) {
    await sendTelegramMessage(chatId, `Keine offene Aktualisierung mit ID "${id}" gefunden.`);
    return;
  }
  await sendTelegramMessage(
    chatId,
    `Freigegeben: "${approved.summary.slice(0, 120)}..." (${approved.sourceLabel}). Ab sofort Teil der Wissensbasis.`
  );
}

async function handleReject(chatId: number, idArg: string | undefined, reason: string | undefined): Promise<void> {
  if (!idArg) {
    await sendTelegramMessage(chatId, 'Bitte mit ID ablehnen: "ablehnen <id> [Grund]". /pending zeigt die Liste.');
    return;
  }
  const rejected = await rejectPendingItem(idArg, reason);
  if (!rejected) {
    await sendTelegramMessage(chatId, `Keine offene Aktualisierung mit ID "${idArg}" gefunden.`);
    return;
  }
  await sendTelegramMessage(
    chatId,
    `Abgelehnt: "${rejected.summary.slice(0, 120)}..." (${rejected.sourceLabel}).${reason ? ` Grund: ${reason}` : ""} Bleibt mit Datum und Begründung im Log.`
  );
}

/**
 * Behandelt Admin-Only-Kommandos (Freigabe-Workflow der Update-Pipeline,
 * siehe build/claude-code-buildplan.md Phase 4). Gibt true zurück, wenn die
 * Nachricht als Admin-Kommando verarbeitet wurde — der Aufrufer soll dann
 * NICHT in die normale Interview-Logik weiterfallen.
 */
export async function handleAdminCommand(chatId: number, text: string): Promise<boolean> {
  if (!isAdminChat(chatId)) return false;

  if (/^\/pending\b/i.test(text)) {
    await handlePendingList(chatId);
    return true;
  }

  const approveMatch = text.match(/^freigeben\b\s*(\S+)?/i);
  if (approveMatch) {
    await handleApprove(chatId, approveMatch[1]);
    return true;
  }

  const rejectMatch = text.match(/^ablehnen\b\s*(\S+)?\s*(.*)?/i);
  if (rejectMatch) {
    await handleReject(chatId, rejectMatch[1], rejectMatch[2]?.trim() || undefined);
    return true;
  }

  return false;
}
