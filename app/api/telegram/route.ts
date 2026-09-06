import { handleAdminCommand } from "@/lib/adminCommands";
import { runInterview } from "@/lib/chat";
import {
  PATIENT_TITLE,
  PATIENT_SUBTITLE,
  DIAGNOSIS_WARNING as WEB_DIAGNOSIS_WARNING,
  CRISIS_NOTE,
  PATIENT_ABOUT_TEXT,
} from "@/lib/content";
import { splitReferences, stripStatsBlock } from "@/lib/format";
import { sendTelegramMessage } from "@/lib/telegram";
import { getSession, saveSession, type TelegramSession } from "@/lib/telegramSession";

export const runtime = "nodejs";
export const maxDuration = 60;

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

// Gleiche Begrüßung/Einweisung wie der Web-Arm (Titel, Untertitel), plus die
// Telegram-spezifische Speicher-Transparenz (siehe README) und ein Verweis auf
// /about statt des Web-Toggles "Über BASTET / Rechtliches".
const WELCOME_HEADER = `${PATIENT_TITLE}
${PATIENT_SUBTITLE}

Rechtliche Hinweise und mehr über BASTET jederzeit per /about.

${CRISIS_NOTE}`;

const GATE_PROMPT = `${WELCOME_HEADER}

Bevor wir starten: Ihre Angaben werden zur Erstellung der Einschätzung an unseren KI-Anbieter (Anthropic) zur Verarbeitung übermittelt. Zusätzlich bleibt Ihr Gesprächsverlauf hier bei uns für die Dauer der aktiven Unterhaltung zwischengespeichert und wird nach 60 Minuten Inaktivität automatisch gelöscht — nicht dauerhaft, aber auch nicht "gar nicht".

Aktuell kann ich nur Text verarbeiten, keine Telegram-Sprachnachrichten. Nutzen Sie daher am besten die Diktierfunktion Ihrer Tastatur — das Mikrofon-Symbol unten rechts neben dem Textfeld, gegenüber vom Emoji-Button. Das wandelt Sprache in Text um, bevor die Nachricht gesendet wird.

Ist bei Ihnen ein Post-COVID-Syndrom bzw. ME/CFS bereits ärztlich diagnostiziert bzw. gesichert? (ja / nein / unklar)`;

const DIAGNOSIS_WARNING = `${WEB_DIAGNOSIS_WARNING} Die folgende Einschätzung ist deshalb rein orientierend und noch unsicherer als sonst.`;

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

  // /about funktioniert jederzeit, unabhängig von der Interview-Phase — das
  // Web-Pendant ist der immer sichtbare "Über BASTET / Rechtliches"-Toggle.
  if (/^\/about\b/i.test(text)) {
    await notifyBestEffort(chatId, PATIENT_ABOUT_TEXT);
    return ok();
  }

  // Für jeden nutzbar: liefert die eigene chat_id, z.B. um sie als
  // TELEGRAM_ADMIN_CHAT_ID zu hinterlegen.
  if (/^\/whoami\b/i.test(text)) {
    await notifyBestEffort(chatId, `Ihre Telegram chat_id: ${chatId}`);
    return ok();
  }

  // Ohne dies gäbe es keinen Weg, ein Gespräch neu zu beginnen außer der
  // 60-Minuten-Inaktivitäts-TTL abzuwarten — Web-Pendant ist ein einfacher
  // Seiten-Reload.
  if (/^\/(neu|reset)\b/i.test(text)) {
    await saveSession(chatId, { messages: [], diagnosisConfirmed: null, turnCount: 0 });
    await sendTelegramMessage(chatId, GATE_PROMPT);
    return ok();
  }

  // Freigabe-Workflow der Wissensbasis-Update-Pipeline (Phase 4) — nur für
  // TELEGRAM_ADMIN_CHAT_ID, läuft komplett außerhalb der Patient:innen-
  // Interviewlogik. Bei Treffer nicht in den normalen Gate/Interview-Flow
  // weiterfallen.
  if (await handleAdminCommand(chatId, text)) {
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
