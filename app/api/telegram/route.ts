import { timingSafeEqual } from "node:crypto";
import { handleAdminCommand } from "@/lib/adminCommands";
import { runInterview } from "@/lib/chat";
import {
  PATIENT_TITLE,
  PATIENT_SUBTITLE,
  DIAGNOSIS_WARNING as WEB_DIAGNOSIS_WARNING,
  CRISIS_NOTE,
  PATIENT_ABOUT_TEXT,
  PATIENT_TITLE_EN,
  PATIENT_SUBTITLE_EN,
  DIAGNOSIS_WARNING_EN as WEB_DIAGNOSIS_WARNING_EN,
  CRISIS_NOTE_EN,
  PATIENT_ABOUT_TEXT_EN,
} from "@/lib/content";
import { hasReferencesBlock, splitReferences, stripStatsBlock } from "@/lib/format";
import { sendTelegramMessage, startTypingIndicator } from "@/lib/telegram";
import { getSession, saveSession, withinRateLimit, type TelegramSession } from "@/lib/telegramSession";
import { incrementCompleted, incrementStarted } from "@/lib/userCount";
import { SESSION_CHAR_HARD_LIMIT, totalMessageChars } from "@/lib/sessionBudget";
import { hasMiniPayAccess } from "@/lib/minipayTelegramToken";
import type { Lang } from "@/lib/lang";

export const runtime = "nodejs";
export const maxDuration = 150;

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
  };
}

// Zweisprachiger Arm seit 03.10.2026 (/language-Befehl, siehe unten). Jeder
// zuvor hier einzeln als Konstante gehaltene Text ist jetzt eine kleine
// Funktion von lang - bewusst KEIN generisches i18n-Framework, nur zwei
// Sprachen, die Texte sind eng an die jeweilige Gesprächslogik gebunden
// (siehe lib/chat.ts für dasselbe Prinzip beim eigentlichen System-Prompt).

function welcomeHeader(lang: Lang): string {
  if (lang === "en") {
    return `${PATIENT_TITLE_EN}
${PATIENT_SUBTITLE_EN}

Legal notes and more about BASTET anytime via /about. Switch language anytime with /language.

${CRISIS_NOTE_EN}`;
  }
  return `${PATIENT_TITLE}
${PATIENT_SUBTITLE}

Rechtliche Hinweise und mehr über BASTET jederzeit per /about. Sprache jederzeit wechselbar mit /language.

${CRISIS_NOTE}`;
}

function gatePrompt(lang: Lang): string {
  if (lang === "en") {
    return `${welcomeHeader(lang)}

Before we start: your information is sent to our AI provider (Anthropic) for processing, to create the assessment. In addition, your conversation is cached here with us for the duration of the active conversation and automatically deleted after 60 minutes of inactivity — not permanently, but not "not at all" either.

Right now I can only process text, not Telegram voice messages. It's best to use your keyboard's dictation feature — the microphone icon at the bottom right next to the text field, opposite the emoji button. That converts speech to text before the message is sent.

Has a Post-COVID syndrome or ME/CFS already been medically diagnosed/confirmed for you? (yes / no / unclear)`;
  }
  return `${welcomeHeader(lang)}

Bevor wir starten: Ihre Angaben werden zur Erstellung der Einschätzung an unseren KI-Anbieter (Anthropic) zur Verarbeitung übermittelt. Zusätzlich bleibt Ihr Gesprächsverlauf hier bei uns für die Dauer der aktiven Unterhaltung zwischengespeichert und wird nach 60 Minuten Inaktivität automatisch gelöscht — nicht dauerhaft, aber auch nicht "gar nicht".

Aktuell kann ich nur Text verarbeiten, keine Telegram-Sprachnachrichten. Nutzen Sie daher am besten die Diktierfunktion Ihrer Tastatur — das Mikrofon-Symbol unten rechts neben dem Textfeld, gegenüber vom Emoji-Button. Das wandelt Sprache in Text um, bevor die Nachricht gesendet wird.

Ist bei Ihnen ein Post-COVID-Syndrom bzw. ME/CFS bereits ärztlich diagnostiziert bzw. gesichert? (ja / nein / unklar)`;
}

function diagnosisWarningText(lang: Lang): string {
  if (lang === "en") {
    return `${WEB_DIAGNOSIS_WARNING_EN} The following assessment is therefore purely orientational and even less certain than usual.`;
  }
  return `${WEB_DIAGNOSIS_WARNING} Die folgende Einschätzung ist deshalb rein orientierend und noch unsicherer als sonst.`;
}

function openingQuestion(lang: Lang): string {
  return lang === "en"
    ? "Thank you. Tell me in your own words what has been going on, and since when — keywords are completely fine, you don't need to write full sentences."
    : "Danke. Erzählen Sie mir in eigenen Worten, was seit wann bei Ihnen los ist — Stichworte reichen völlig, Sie müssen keine ganzen Sätze schreiben.";
}

// Zahlungspflichtig seit 03.10.2026 (siehe lib/minipayTelegramToken.ts): die
// ausführliche KI-Auswertung (Tier 2, echter Anthropic-API-Call) kostet hier
// echtes Geld pro Anfrage. Der MiniPay-Zahlungslink (bastet.osirisapp.xyz)
// fehlt hier bewusst noch - die Seite ist gebaut, aber noch nicht deployed/
// domain-verbunden (siehe OSIRIS-Repo, apis/bastet-pay). NACHTRAGEN, sobald
// die Domain live ist, sonst zeigt die Nachricht einen toten Link.
function paywallMessage(lang: Lang): string {
  if (lang === "en") {
    return `The full AI assessment here in the Telegram chat is a paid feature: 6 hours of full access for 4.99 USDT, payable via MiniPay (payment page coming soon, currently still being built).

In the meantime, BASTET remains free to use via the website: https://www.bastet-covid.org`;
  }
  return `Die ausführliche KI-Auswertung ist hier im Telegram-Chat ein kostenpflichtiges Angebot: 6 Stunden voller Zugang für 4,99 USDT, bezahlbar per MiniPay (Zahlungsseite folgt in Kürze, aktuell noch im Aufbau).

Kostenlos nutzbar ist BASTET in der Zwischenzeit über die Website: https://www.bastet-covid.org`;
}

function hardLimitMessage(lang: Lang): string {
  return lang === "en"
    ? "We've now collected a lot of information - that's enough for a good assessment. Please wait a moment for the ongoing assessment to finish, or start a new, shorter session with /neu."
    : "Wir haben inzwischen sehr viele Angaben gesammelt - das reicht für eine gute Einschätzung. Bitte warten Sie kurz auf den Abschluss der laufenden Auswertung, oder beginnen Sie mit /neu eine neue, kürzere Sitzung.";
}

function technicalErrorDuringInterview(lang: Lang, message: string): string {
  return lang === "en"
    ? `Technical problem: ${message} — your information is still here, just keep writing or try again.`
    : `Technisches Problem: ${message} — Ihre Angaben sind noch da, schreiben Sie einfach weiter oder versuchen Sie es erneut.`;
}

function aboutText(lang: Lang): string {
  return lang === "en" ? PATIENT_ABOUT_TEXT_EN : PATIENT_ABOUT_TEXT;
}

function whoamiText(lang: Lang, chatId: number): string {
  return lang === "en" ? `Your Telegram chat_id: ${chatId}` : `Ihre Telegram chat_id: ${chatId}`;
}

function referencesLabel(lang: Lang): string {
  return lang === "en" ? "📚 References:" : "📚 Referenzen:";
}

// /language ohne (bekanntes) Argument schaltet um - mit "en"/"english" bzw.
// "de"/"german"/"deutsch" wird die Sprache explizit gesetzt. Bewusst per
// Toggle statt reiner Status-Anzeige ohne Argument: ein Tap/Befehl reicht,
// um zu wechseln, ohne vorher nachsehen zu müssen, welche Sprache gerade
// aktiv ist.
function parseLanguageArg(text: string): string | undefined {
  const match = /^\/language\b\s*(\S*)/i.exec(text);
  return match?.[1]?.toLowerCase();
}

function resolveRequestedLang(arg: string | undefined, current: Lang): Lang {
  if (arg === "en" || arg === "english") return "en";
  if (arg === "de" || arg === "german" || arg === "deutsch") return "de";
  return current === "de" ? "en" : "de";
}

function languageSwitchedMessage(lang: Lang): string {
  return lang === "en"
    ? "Language set to English. Switch anytime with /language (or /language de for German)."
    : "Sprache auf Deutsch gestellt. Jederzeit wechselbar mit /language (oder /language en für Englisch).";
}

// Flooding-Limit- und äußerste Fehlermeldung können VOR jedem Session-Read
// auftreten (siehe POST() unten) - zu diesem Zeitpunkt ist die bevorzugte
// Sprache noch nicht bekannt, ein zusätzlicher Redis-Read nur dafür wäre
// unverhältnismäßig für diese seltenen Randfälle. Deshalb bewusst zweisprachig
// in einer Nachricht statt sprachabhängig.
const RATE_LIMIT_MESSAGE_BILINGUAL =
  "Das waren in kurzer Zeit sehr viele Nachrichten - bitte einen Moment Pause, dann geht es weiter. / That was a lot of messages in a short time - please wait a moment, then we can continue.";

function outerErrorMessageBilingual(message: string): string {
  return `Technisches Problem: ${message} — bitte in ein paar Minuten erneut versuchen. / Technical problem: ${message} — please try again in a few minutes.`;
}

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
    await notifyBestEffort(chatId, RATE_LIMIT_MESSAGE_BILINGUAL);
    return ok();
  }

  // /language funktioniert jederzeit, unabhängig von der Interview-Phase -
  // einziger Befehl hier, der den Session-State liest/schreibt, ohne die
  // übrige Interviewlogik zu berühren (Nachrichtenverlauf/Diagnose-Gate/
  // Turn-Zähler bleiben unangetastet, nur lang ändert sich).
  if (/^\/language\b/i.test(text)) {
    const session = await getSession(chatId);
    const newLang = resolveRequestedLang(parseLanguageArg(text), session.lang);
    session.lang = newLang;
    await saveSession(chatId, session);
    await notifyBestEffort(chatId, languageSwitchedMessage(newLang));
    return ok();
  }

  // /about funktioniert jederzeit, unabhängig von der Interview-Phase — das
  // Web-Pendant ist der immer sichtbare "Über BASTET / Rechtliches"-Toggle.
  if (/^\/about\b/i.test(text)) {
    const session = await getSession(chatId);
    await notifyBestEffort(chatId, aboutText(session.lang));
    return ok();
  }

  // Für jeden nutzbar: liefert die eigene chat_id, z.B. um sie als
  // TELEGRAM_ADMIN_CHAT_ID zu hinterlegen.
  if (/^\/whoami\b/i.test(text)) {
    const session = await getSession(chatId);
    await notifyBestEffort(chatId, whoamiText(session.lang, chatId));
    return ok();
  }

  // Ohne dies gäbe es keinen Weg, ein Gespräch neu zu beginnen außer der
  // 60-Minuten-Inaktivitäts-TTL abzuwarten — Web-Pendant ist ein einfacher
  // Seiten-Reload. Sprachwahl bleibt über den Reset hinweg erhalten (ist eine
  // Oberflächen-Präferenz, kein Teil der zurückgesetzten Gesprächsdaten).
  if (/^\/(neu|reset)\b/i.test(text)) {
    const existing = await getSession(chatId);
    await saveSession(chatId, { messages: [], diagnosisConfirmed: null, turnCount: 0, lang: existing.lang });
    await sendTelegramMessage(chatId, gatePrompt(existing.lang));
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

    // Diagnose-Gate als erste Interaktion, analog zum Web-Interface (siehe
    // app/page.tsx). Erkennt Antworten in BEIDEN Sprachen unabhängig von
    // session.lang - robuster gegen eine falsch geratene/noch nicht
    // umgestellte Sprache, als nur das jeweils "aktive" Sprachmuster zu
    // akzeptieren.
    if (session.diagnosisConfirmed === null) {
      if (/^(ja|yes)\b/i.test(text)) {
        session.diagnosisConfirmed = true;
      } else if (/^(nein|no|unklar|unclear)\b/i.test(text)) {
        session.diagnosisConfirmed = false;
      } else {
        await sendTelegramMessage(chatId, gatePrompt(session.lang));
        await saveSession(chatId, session);
        return ok();
      }

      session.messages = [{ role: "assistant", content: openingQuestion(session.lang) }];
      session.turnCount = 0;
      await saveSession(chatId, session);

      if (!session.diagnosisConfirmed) {
        await sendTelegramMessage(chatId, diagnosisWarningText(session.lang));
      }
      await sendTelegramMessage(chatId, openingQuestion(session.lang));
      return ok();
    }

    // War in einer vorherigen Runde schon eine vollständige Auswertung mit
    // REFERENZEN-Block dabei? Nur dann NICHT noch einmal als "completed"
    // zählen, wenn diese Runde erneut einen liefert (gleiches Prinzip wie
    // app/api/chat/route.ts). Vor dem Push berechnet, ändert sich durch ihn nicht.
    // hasReferencesBlock() statt direktem .includes(REFERENZEN_MARKER):
    // erkennt sowohl den deutschen ("REFERENZEN:") als auch den englischen
    // ("REFERENCES:") Marker, da dieser Arm seit 03.10.2026 zweisprachig ist
    // (siehe lib/format.ts).
    const alreadyCompleted = session.messages.some(
      (m) => m.role === "assistant" && typeof m.content === "string" && hasReferencesBlock(m.content)
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
      await notifyBestEffort(chatId, hardLimitMessage(session.lang));
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
      await sendTelegramMessage(chatId, paywallMessage(session.lang));
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
      raw = await runInterview(
        session.messages,
        session.diagnosisConfirmed,
        session.turnCount,
        null,
        null,
        false,
        null,
        session.lang
      );
    } catch (error) {
      // Nutzer:in-Nachricht bleibt in der Session erhalten, damit beim nächsten
      // Versuch nichts verloren geht — nur die fehlgeschlagene Antwort fehlt.
      await saveSession(chatId, session);
      const message = error instanceof Error ? error.message : "unbekannter Fehler";
      await notifyBestEffort(chatId, technicalErrorDuringInterview(session.lang, message));
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
    if (!alreadyCompleted && hasReferencesBlock(cleaned)) {
      await incrementCompleted("telegram");
    }

    const { body, refs } = splitReferences(cleaned);
    await sendTelegramMessage(chatId, body);
    if (refs && refs.length > 0) {
      await sendTelegramMessage(chatId, `${referencesLabel(session.lang)}\n` + refs.join("\n"));
    }

    return ok();
  } catch (error) {
    // Fängt alles ab, was vor/außerhalb der runInterview-Logik schiefgehen kann
    // (z.B. Redis/Upstash nicht erreichbar) — ohne dieses äußere try/catch
    // würde die Anfrage mit 500 sterben und Nutzer:innen bekommen komplette
    // Stille statt einer Fehlermeldung. Session (und damit lang) ist an
    // dieser Stelle ggf. selbst nicht lesbar gewesen (z.B. Redis down) -
    // deshalb bewusst zweisprachig statt von session.lang abhängig.
    console.error("Telegram-Webhook-Fehler:", error);
    const message = error instanceof Error ? error.message : "unbekannter Fehler";
    await notifyBestEffort(chatId, outerErrorMessageBilingual(message));
    return ok();
  }
}
