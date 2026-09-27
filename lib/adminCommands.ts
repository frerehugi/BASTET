import { sendTelegramMessage } from "./telegram";
import { approvePendingItem, getPendingItems, rejectPendingItem, type PendingItem } from "./reviewQueue";
import { getUserCounts, setStartedCount, setCompletedCount, resetAllCounts, type UserCounts } from "./userCount";
import { getSelfToggleState, hasSelfConfig, setSelfEnabled, type SelfArm } from "./selfFeatureFlag";

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

/**
 * Rein anonyme Nutzungszähler (siehe lib/userCount.ts) - "gestartet" minus
 * "abgeschlossen" ergibt die grobe Abbruchrate je Arm. Layout bewusst als
 * EIN Trichter (Landing -> Tier 1 -> Tier 2) plus zwei separate, eigene
 * Kanäle (Doc-Arm, Telegram-Arm) - deckt sich mit dem tatsächlichen
 * Nutzungsweg (siehe app/page.tsx: arztVerweis ist ein Ausstieg AUS dem
 * Trichter, kein Schritt "davon weiter zu Tier 1"; Doc-/Telegram-Arm haben
 * keinen Landing-/Tier-1-Vorlauf). "Tier 1" wird nur einmal gezeigt (vorher
 * doppelt: einmal als "davon bis Tier 1 gekommen", einmal als eigene
 * Zeile) - reine Anzeige-Redundanz, keine Datenredundanz.
 */
async function handleStats(chatId: number): Promise<void> {
  const counts = await getUserCounts();
  await sendTelegramMessage(chatId, formatStats(counts));
}

/**
 * Reiner Formatierungsschritt, getrennt von handleStats() getestet/nutzbar
 * (kein Redis/Telegram-Aufruf nötig) - Text bewusst ohne Markdown/HTML, da
 * sendTelegramMessage() ohne parse_mode sendet (siehe lib/telegram.ts).
 */
function formatStats(counts: UserCounts): string {
  // Tier 1 ist strukturell IMMER Voraussetzung für einen Web-Arm-Start
  // (siehe handleBackfillTier1 unten) - completed darf also nie unter
  // web.started liegen. Tut es das doch, ist der Tier-1-Zähler veraltet
  // (Zählung startete erst mit 9a) - Hinweis auf die Korrektur statt
  // stillschweigend falscher Zahlen.
  const tier1Veraltet = counts.tier1.completed < counts.web.started;

  return (
    `📊 Nutzungszähler (anonym, seit Zählbeginn)\n\n` +
    `Web-Trichter\n` +
    `  Start: ${counts.landing.started}\n` +
    `  → Arzt empfohlen statt Selbsttest: ${counts.arztVerweis.started}\n` +
    `  → Tier 1 (regelbasiert): ${counts.tier1.started} gestartet, ${counts.tier1.completed} abgeschlossen\n` +
    `  → Tier 2 (KI-Chat): ${counts.web.started} gestartet, ${counts.web.completed} abgeschlossen\n\n` +
    `Doc-Arm: ${counts.doc.started} gestartet, ${counts.doc.completed} abgeschlossen\n` +
    `Telegram-Arm: ${counts.telegram.started} gestartet, ${counts.telegram.completed} abgeschlossen` +
    (tier1Veraltet
      ? `\n\n⚠️ Tier-1-Zähler unter Web-Arm gestartet (${counts.web.started}) - strukturell unmöglich. "backfill tier1" korrigiert das.`
      : "")
  );
}

const SELF_ARM_LABEL: Record<SelfArm, string> = { web: "Web (Tier 2)", doc: "Doc-Arm" };

/**
 * Einmalige rückwirkende Korrektur des Tier-1-Zählers (siehe Chat vom
 * 26.09.2026): "web:started" (erster /api/chat-Call) ist strukturell NIE
 * ohne einen zuvor abgeschlossenen Tier-1-Durchlauf erreichbar (siehe
 * app/page.tsx: startChat() setzt immer erst phase="triage", "chat" ist nur
 * über handleTriageComplete() -> beginDetailanalyse() erreichbar). Der
 * Tier-1-Zähler selbst existiert aber erst seit dem 9a-Rollout - alle
 * Tier-1-Durchläufe davor liefen, wurden aber nie gezählt.
 *
 * Beweisbare Untergrenze: die echte historische tier1:completed-Zahl war
 * MINDESTENS so groß wie web:started (jeder Web-Start beweist einen
 * vorherigen Tier-1-Abschluss). Für tier1:started gilt dieselbe Untergrenze
 * (mindestens so viele Starts wie Abschlüsse) - die echte Zahl war
 * vermutlich höher (abgebrochene Tier-1-Versuche, die nie zu Tier 2 führten,
 * sind unwiederbringlich verloren, da nie geloggt). Deshalb bewusst max(...)
 * statt eines Ersetzens, und eine Bestätigungsnachricht mit Vorher-/
 * Nachher-Werten statt eines stillen Redis-Writes - das bleibt eine
 * dokumentierte Korrektur, keine echte Messung.
 *
 * Idempotent: erneutes Ausführen (z.B. aus Versehen) hebt die Zahlen nur an,
 * falls web:started seitdem weiter gewachsen ist, senkt sie nie ab.
 */
async function handleBackfillTier1(chatId: number): Promise<void> {
  const counts = await getUserCounts();
  const newStarted = Math.max(counts.tier1.started, counts.web.started);
  const newCompleted = Math.max(counts.tier1.completed, counts.web.started);

  if (newStarted === counts.tier1.started && newCompleted === counts.tier1.completed) {
    await sendTelegramMessage(
      chatId,
      `Tier-1-Zähler ist bereits konsistent mit Web-Arm gestartet (${counts.web.started}) - keine Änderung nötig.`
    );
    return;
  }

  await Promise.all([setStartedCount("tier1", newStarted), setCompletedCount("tier1", newCompleted)]);

  await sendTelegramMessage(
    chatId,
    `Tier-1-Zähler rückwirkend korrigiert (Mindestschätzung, keine echte Messung - siehe Begründung: ` +
      `jeder Web-Arm-Start setzt einen abgeschlossenen Tier-1-Durchlauf voraus, abgebrochene Tier-1-Versuche vor ` +
      `dem 9a-Rollout bleiben unbekannt):\n` +
      `gestartet: ${counts.tier1.started} → ${newStarted}\n` +
      `abgeschlossen: ${counts.tier1.completed} → ${newCompleted}`
  );
}

/**
 * Kompletter, irreversibler Reset aller Nutzungszähler auf 0 (siehe
 * lib/userCount.ts, resetAllCounts()) - für einen bewussten Neustart der
 * Zählung, z.B. unmittelbar vor der Aktivierung von Self für einen neuen
 * Arm, damit Testläufe aus der Einrichtungsphase die späteren echten
 * Nutzungszahlen nicht verfälschen. Zeigt den alten Stand VOR dem Reset,
 * damit er nicht ersatzlos verloren geht, falls er doch noch gebraucht wird.
 */
async function handleResetStats(chatId: number): Promise<void> {
  const before = await getUserCounts();
  await resetAllCounts();
  await sendTelegramMessage(
    chatId,
    `Alle Nutzungszähler auf 0 zurückgesetzt. Stand davor:\n\n${formatStats(before)}`
  );
}

/**
 * Ein-/Ausschalter für die Self-Verifizierung (build/phase9-bastet-2.0-
 * self-gatekeeper.md, 9b/9d) - bewusst als einfacher Telegram-Befehl statt
 * eines Deploys, damit "schalte Self aus" sofort wirkt (Redis-Flag, siehe
 * lib/selfFeatureFlag.ts) und BASTET ohne jede weitere Änderung in den
 * Zustand von vor der Self-Integration zurückkehrt.
 *
 * Seit 9d ein Schalter PRO ARM (Florian wollte Self zunächst nur für den
 * Doc-Arm aktivieren, ohne den Web-Arm mit umzuschalten) - der Arm ist
 * deshalb, anders als zuvor, ein verpflichtender erster Teil des Arguments
 * ("self doc an"), außer bei der reinen Statusabfrage ohne Argument, die
 * beide Arme auf einmal zeigt.
 */
async function handleSelfToggle(chatId: number, arg: string | undefined): Promise<void> {
  const parts = (arg ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const configured = hasSelfConfig();
  const configHint = configured
    ? ""
    : "\nSELF_API_KEY/SELF_FLOW_ID/SELF_WEBHOOK_SECRET fehlen — bleibt deshalb technisch immer aus, unabhängig vom Schalter.";

  // Kein Argument oder nur "status": Überblick über beide Arme auf einmal.
  if (parts.length === 0 || (parts.length === 1 && parts[0] === "status")) {
    const lines = await Promise.all(
      (["web", "doc"] as SelfArm[]).map(async (arm) => {
        const state = await getSelfToggleState(arm);
        const effektivAn = state === "on" && configured;
        return `${SELF_ARM_LABEL[arm]}: ${effektivAn ? "AN" : "AUS"} (Schalter: ${state === "on" ? "an" : "aus"})`;
      })
    );
    await sendTelegramMessage(
      chatId,
      `Self-Verifizierung:\n${lines.join("\n")}${configHint}\nUmschalten: "self web an" · "self doc an" · "self web aus" · "self doc aus"`
    );
    return;
  }

  const armArg = parts[0];
  if (armArg !== "web" && armArg !== "doc") {
    await sendTelegramMessage(chatId, 'Bitte Arm angeben: "self web ..." oder "self doc ...". Nur "self status" zeigt beide.');
    return;
  }
  const arm: SelfArm = armArg;
  const action = parts[1];

  if (!action || action === "status") {
    const state = await getSelfToggleState(arm);
    const effektivAn = state === "on" && configured;
    await sendTelegramMessage(
      chatId,
      `Self-Verifizierung (${SELF_ARM_LABEL[arm]}): ${effektivAn ? "AN" : "AUS"} (Schalter: ${state === "on" ? "an" : "aus"})${configHint}\nUmschalten: "self ${arm} an" / "self ${arm} aus"`
    );
    return;
  }
  if (/^(an|ein|aktivieren)$/.test(action)) {
    await setSelfEnabled(arm, true);
    await sendTelegramMessage(
      chatId,
      configured
        ? `Self-Verifizierung für ${SELF_ARM_LABEL[arm]} eingeschaltet — verlangt ab jetzt eine Verifizierung.`
        : `Schalter für ${SELF_ARM_LABEL[arm]} steht jetzt auf 'an', aber SELF_API_KEY/SELF_FLOW_ID/SELF_WEBHOOK_SECRET fehlen noch — bleibt deshalb technisch aus, bis diese gesetzt sind.`
    );
    return;
  }
  if (/^(aus|deaktivieren)$/.test(action)) {
    await setSelfEnabled(arm, false);
    await sendTelegramMessage(
      chatId,
      `Self-Verifizierung für ${SELF_ARM_LABEL[arm]} ausgeschaltet — läuft ab sofort wieder wie vor der Self-Integration, ohne Verifizierungsschritt.`
    );
    return;
  }
  await sendTelegramMessage(chatId, 'Unbekannter Befehl. "self status" · "self doc an" · "self doc aus" · "self web an" · "self web aus".');
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

  if (/^\/stats\b/i.test(text)) {
    await handleStats(chatId);
    return true;
  }

  if (/^backfill\s+tier1\b/i.test(text)) {
    await handleBackfillTier1(chatId);
    return true;
  }

  if (/^z(ä|ae)hler\s+nullen\b/i.test(text)) {
    await handleResetStats(chatId);
    return true;
  }

  const selfMatch = text.match(/^self\b\s*(.*)?/i);
  if (selfMatch) {
    await handleSelfToggle(chatId, selfMatch[1]);
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
