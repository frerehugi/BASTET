import { runInterview } from "@/lib/chat";
import { splitReferences, stripStatsBlock } from "@/lib/format";
import { sendTelegramMessage } from "@/lib/telegram";
import { getSession, saveSession, type TelegramSession } from "@/lib/telegramSession";

export const runtime = "nodejs";

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

const GATE_PROMPT = `Bevor wir starten: Ihr Gesprächsverlauf wird für die Dauer der aktiven Unterhaltung zwischengespeichert und nach 60 Minuten Inaktivität automatisch gelöscht — nicht dauerhaft, aber auch nicht "gar nicht".

Ist bei Ihnen ein Post-COVID-Syndrom bzw. ME/CFS bereits ärztlich diagnostiziert bzw. gesichert? (ja / nein / unklar)`;

const DIAGNOSIS_WARNING =
  "Dies ist keine medizinische Beratung und kann keine Diagnose stellen oder ersetzen. Ohne gesicherte Diagnose ist eine ärztliche Untersuchung erforderlich. Die folgende Einschätzung ist deshalb rein orientierend und noch unsicherer als sonst.";

const OPENING_QUESTION =
  "Danke. Erzählen Sie mir in eigenen Worten, was seit wann bei Ihnen los ist — Stichworte reichen völlig, Sie müssen keine ganzen Sätze schreiben.";

function ok(): Response {
  // Telegram erwartet 200 auf jedes Webhook-Update, sonst wird zugestellt/erneut versucht.
  return new Response("ok");
}

async function notifyBestEffort(chatId: number, text: string): Promise<void> {
  // Wird aus einem bereits fehlgeschlagenen Pfad aufgerufen - ein zweiter
  // Fehler hier (z.B. TELEGRAM_BOT_TOKEN selbst kaputt) darf die Response an
  // Telegram nicht mehr verhindern, landet aber im Server-Log (Vercel Logs).
  try {
    await sendTelegramMessage(chatId, text);
  } catch (error) {
    console.error("Telegram-Fehlermeldung konnte nicht zugestellt werden:", error);
  }
}

export async function POST(request: Request): Promise<Response> {
  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return ok();
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();

  if (!chatId || !text) {
    return ok();
  }

  try {
    const session: TelegramSession = await getSession(chatId);

    // Diagnose-Gate als erste Interaktion, analog zum Web-Interface (siehe app/page.tsx).
    if (session.diagnosisConfirmed === null) {
      if (/^ja\b/i.test(text)) {
        session.diagnosisConfirmed = true;
      } else if (/^(nein|unklar)/i.test(text)) {
        session.diagnosisConfirmed = false;
      } else {
        await sendTelegramMessage(chatId, GATE_PROMPT);
        await saveSession(chatId, session);
        return ok();
      }

      session.messages = [{ role: "assistant", content: OPENING_QUESTION }];
      session.turnCount = 0;
      await saveSession(chatId, session);

      if (!session.diagnosisConfirmed) {
        await sendTelegramMessage(chatId, DIAGNOSIS_WARNING);
      }
      await sendTelegramMessage(chatId, OPENING_QUESTION);
      return ok();
    }

    // Normale Interview-Runde.
    session.messages.push({ role: "user", content: text });
    session.turnCount += 1;

    let raw: string;
    try {
      raw = await runInterview(session.messages, session.diagnosisConfirmed, session.turnCount);
    } catch (error) {
      // Nutzer:in-Nachricht bleibt in der Session erhalten, damit beim nächsten
      // Versuch nichts verloren geht — nur die fehlgeschlagene Antwort fehlt.
      await saveSession(chatId, session);
      const message = error instanceof Error ? error.message : "unbekannter Fehler";
      await notifyBestEffort(
        chatId,
        `Technisches Problem: ${message} — Ihre Angaben sind noch da, schreiben Sie einfach weiter oder versuchen Sie es erneut.`
      );
      return ok();
    }

    const cleaned = stripStatsBlock(raw);
    session.messages.push({ role: "assistant", content: cleaned });
    await saveSession(chatId, session);

    const { body, refs } = splitReferences(cleaned);
    await sendTelegramMessage(chatId, body);
    if (refs && refs.length > 0) {
      await sendTelegramMessage(chatId, "📚 Referenzen:\n" + refs.join("\n"));
    }

    return ok();
  } catch (error) {
    // Fängt alles ab, was vor/außerhalb der runInterview-Logik schiefgehen kann
    // (z.B. Redis/Upstash nicht erreichbar) — ohne dieses äußere try/catch
    // würde die Anfrage mit 500 sterben und Nutzer:innen bekommen komplette
    // Stille statt einer Fehlermeldung.
    console.error("Telegram-Webhook-Fehler:", error);
    const message = error instanceof Error ? error.message : "unbekannter Fehler";
    await notifyBestEffort(
      chatId,
      `Technisches Problem: ${message} — bitte in ein paar Minuten erneut versuchen.`
    );
    return ok();
  }
}
