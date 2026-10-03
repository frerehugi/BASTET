import { timingSafeEqual } from "node:crypto";
import { handleAdminCommand } from "@/lib/adminCommands";
import { runInterview } from "@/lib/chat";
import {
  PATIENT_TITLE,
  PATIENT_SUBTITLE,
  DIAGNOSIS_WARNING as WEB_DIAGNOSIS_WARNING,
  CRISIS_NOTE,
  PATIENT_ABOUT_TEXT,
} from "@/lib/content";
import { REFERENZEN_MARKER, splitReferences, stripStatsBlock } from "@/lib/format";
import { sendTelegramMessage, startTypingIndicator } from "@/lib/telegram";
import { getSession, saveSession, withinRateLimit, type TelegramSession } from "@/lib/telegramSession";
import { incrementCompleted, incrementStarted } from "@/lib/userCount";
import { SESSION_CHAR_HARD_LIMIT, totalMessageChars } from "@/lib/sessionBudget";
import { hasMiniPayAccess } from "@/lib/minipayTelegramToken";

export const runtime = "nodejs";
export const maxDuration = 150;

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

// Zahlungspflichtig seit 03.10.2026 (siehe lib/minipayTelegramToken.ts): die
// ausführliche KI-Auswertung (Tier 2, echter Anthropic-API-Call) kostet hier
// echtes Geld pro Anfrage. Der MiniPay-Zahlungslink (bastet.osirisapp.xyz)
// fehlt hier bewusst noch - die Seite ist gebaut, aber noch nicht deployed/
// domain-verbunden (siehe OSIRIS-Repo, apis/bastet-pay). NACHTRAGEN, sobald
// die Domain live ist, sonst zeigt die Nachricht einen toten Link.
const PAYWALL_MESSAGE = `Die ausführliche KI-Auswertung ist hier im Telegram-Chat ein kostenpflichtiges Angebot: 6 Stunden voller Zugang für 4,99 USDT, bezahlbar per MiniPay (Zahlungsseite folgt in Kürze, aktuell noch im Aufbau).

Kostenlos nutzbar ist BASTET in der Zwischenzeit über die Website: https://www.bastet-covid.org`;

function ok(): Response {
  // Telegram erwartet 200 auf jedes Webhook-Update, sonst wird zugestellt/erneut versucht.
  return new Response("ok");
}

// Ohne diese Prüfung kann jede:r, die/der die numerische Admin-chat_id kennt
// oder errät, den Webhook direkt (ohne Telegram) mit einem gefälschten Body
// aufrufen und den Freigabe-Workflow der Wissensbasis erreichen (handleAdminCommand
// vertraut allein der chat_id im Body). Der secret_token wird einmalig per
// setWebhook hinterlegt (siehe README) — Telegram schickt ihn danach bei jeder
// echten Zustellung im Header zurück, ein Angreifer kennt ihn nicht.
function hasValidTelegramSecret(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false; // kein Secret konfiguriert -> zu, nicht offen
  const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
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
  if (!hasValidTelegramSecret(request)) {
    return new Response("unauthorized", { status: 401 });
  }

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

  // Flooding-Limit (Frequenz) ganz am Anfang, vor jedem Befehl/Interview-
  // Pfad - ein Redis-Ausfall lässt die Anfrage durch (siehe withinRateLimit),
  // blockiert also nie versehentlich den ganzen Bot.
  if (!(await withinRateLimit(chatId))) {
    await notifyBestEffort(
      chatId,
      "Das waren in kurzer Zeit sehr viele Nachrichten - bitte einen Moment Pause, dann geht es weiter."
    );
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

    // War in einer vorherigen Runde schon eine vollständige Auswertung mit
    // REFERENZEN-Block dabei? Nur dann NICHT noch einmal als "completed"
    // zählen, wenn diese Runde erneut einen liefert (gleiches Prinzip wie
    // app/api/chat/route.ts). Vor dem Push berechnet, ändert sich durch ihn nicht.
    const alreadyCompleted = session.messages.some(
      (m) => m.role === "assistant" && typeof m.content === "string" && m.content.includes(REFERENZEN_MARKER)
    );

    // Harte Rückfalllinie hinter dem weichen Hinweis in lib/chat.ts
    // (budgetHintFor/SESSION_CHAR_HARD_LIMIT, siehe lib/sessionBudget.ts):
    // War die Sitzung VOR dieser Nachricht schon über dem Hard-Limit, hatte
    // das Modell im letzten Zug bereits die Anweisung "leite JETZT über" -
    // noch mehr Material anzuhängen, bevor das greift, würde die Sitzung
    // unbegrenzt weiter wachsen lassen. Bewusst VOR dem MiniPay-Gate geprüft,
    // sonst wäre dieser Schutz für unbezahlte Versuche wirkungslos (die
    // würden sonst ungebremst Text anhäufen dürfen, nur ohne LLM-Call). Nur
    // relevant, solange noch keine fertige Auswertung vorliegt; danach ist
    // das Risiko ein anderes (Rückfragen zu einem bereits gelieferten
    // Ergebnis), bewusst nicht hier mitgedeckelt.
    if (!alreadyCompleted && totalMessageChars(session.messages) >= SESSION_CHAR_HARD_LIMIT) {
      await notifyBestEffort(
        chatId,
        "Wir haben inzwischen sehr viele Angaben gesammelt - das reicht für eine gute Einschätzung. Bitte warten Sie kurz auf den Abschluss der laufenden Auswertung, oder beginnen Sie mit /neu eine neue, kürzere Sitzung."
      );
      return ok();
    }

    // Nutzer:innen-Text sichern (gleiches Prinzip wie im catch weiter unten -
    // "nichts geht verloren"), BEVOR das MiniPay-Gate greift. Wer unbezahlt
    // schreibt, bekommt zwar jetzt keine Auswertung, aber der bereits
    // getippte Text ist nicht weg, sobald der 6h-Zugang später freigeschaltet
    // wird - die nächste erlaubte Runde sieht ihn dann im Verlauf.
    session.messages.push({ role: "user", content: text });
    session.turnCount += 1;
    await saveSession(chatId, session);

    // MiniPay-Gate: jede echte Interview-Runde ab hier löst einen echten
    // Anthropic-API-Call aus (lib/minipayTelegramToken.ts, hasMiniPayAccess).
    // Bewusst VOR incrementStarted geprüft, damit unbezahlte Versuche nicht
    // die Tier-2-Nutzungszähler verfälschen (die sollen echte Tier-2-Nutzung
    // messen, nicht bloßes Interesse). Diagnose-Gate und OPENING_QUESTION
    // oben bleiben für alle frei (kein API-Call, keine Kosten).
    if (!(await hasMiniPayAccess(chatId))) {
      await sendTelegramMessage(chatId, PAYWALL_MESSAGE);
      return ok();
    }

    // "Sitzung gestartet" = erste echte Interview-Runde (nur die
    // OPENING_QUESTION stand vor diesem Push in session.messages) - siehe
    // lib/userCount.ts. AWAIT statt void, siehe Begründung bei
    // incrementCompleted weiter unten.
    if (session.messages.length === 2) await incrementStarted("telegram");

    // Telegram kann - anders als der Web-Chat-Arm (siehe lib/anthropic.ts,
    // streamClaude) - nicht streamen; "tippt…" ist der pragmatische Ersatz,
    // damit bei mehreren Sekunden Generierungszeit nicht stillschweigend
    // gewartet wird (build/effizienz-plan.md Abschnitt 3).
    const stopTyping = startTypingIndicator(chatId);
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
    } finally {
      stopTyping();
    }

    const cleaned = stripStatsBlock(raw);
    session.messages.push({ role: "assistant", content: cleaned });
    await saveSession(chatId, session);

    // AWAIT statt void: derselbe Serverless-Teardown-Fallstrick wie in
    // app/api/chat/route.ts/app/api/doc/route.ts - hier zwar mit
    // nachfolgendem sendTelegramMessage() als zusätzlichem Zeitpuffer, aber
    // ohne Garantie, dass die Function-Instanz solange am Leben bleibt.
    if (!alreadyCompleted && cleaned.includes(REFERENZEN_MARKER)) {
      await incrementCompleted("telegram");
    }

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
