// Serverseitige Zwischenspeicherung des ausgefüllten Fragebogens für die
// kostenpflichtige Detailanalyse (nur relevant bei PAYWALL_ENABLED=true).
// Existiert NUR für Nutzer:innen, die die Detailanalyse ausfüllen UND eine
// aktive Bezahlschranke antreffen — die kostenlose Schnell-Einschätzung
// bleibt No-Storage wie bisher (siehe lib/chat.ts runQuickAssessment), und
// bei deaktiviertem Kill-Switch läuft die Detailanalyse direkt ohne diesen
// Speicher (siehe app/api/detailed-assessment/route.ts).
//
// Warum überhaupt Speicherung nötig ist: Die Zahlungsbestätigung läuft über
// einen asynchronen Stripe-Webhook (app/api/stripe/webhook/route.ts), der
// unabhängig vom Client eintrifft. Ohne serverseitige Ablage des Fragebogens
// gäbe es keine Möglichkeit, die Detailanalyse erst NACH echter, webhook-
// verifizierter Zahlung zu erzeugen, ohne dem Client (der die Zahlung fälschen
// könnte) blind zu vertrauen.
import { Redis } from "@upstash/redis";
import type { Stage1Answers, Stage2Answers } from "./interviewAnswers";

let cachedRedis: Redis | null = null;

function getRedis(): Redis {
  if (cachedRedis) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "UPSTASH_REDIS_KV_REST_API_URL/_TOKEN sind auf dem Server nicht gesetzt (Vercel Environment Variables)."
    );
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

// Zahlungsvorgänge dauern Minuten, nicht Stunden — 2 Stunden TTL lässt
// genug Puffer für Zahlungsprobleme/Retries, ohne Gesundheitsangaben unnötig
// lange vorzuhalten. Nach erfolgreicher Auslieferung wird der Eintrag zudem
// aktiv gelöscht (siehe deleteAssessmentSession), die TTL ist nur das
// Sicherheitsnetz für abgebrochene/fehlgeschlagene Zahlungen.
const SESSION_TTL_SECONDS = 60 * 60 * 2;

export type AssessmentSessionStatus = "pending_payment" | "paid";

export interface AssessmentSession {
  status: AssessmentSessionStatus;
  stage1: Stage1Answers;
  stage2: Stage2Answers;
  diagnosisConfirmed: boolean;
  createdAt: number;
  paidAt?: number;
}

function sessionKey(sessionId: string): string {
  return `bastet:assessment:${sessionId}`;
}

export async function createAssessmentSession(
  sessionId: string,
  data: Omit<AssessmentSession, "status" | "createdAt">
): Promise<void> {
  const session: AssessmentSession = { ...data, status: "pending_payment", createdAt: Date.now() };
  await getRedis().set(sessionKey(sessionId), session, { ex: SESSION_TTL_SECONDS });
}

export async function getAssessmentSession(sessionId: string): Promise<AssessmentSession | null> {
  return await getRedis().get<AssessmentSession>(sessionKey(sessionId));
}

export async function markAssessmentSessionPaid(sessionId: string): Promise<void> {
  const existing = await getAssessmentSession(sessionId);
  if (!existing) {
    console.warn("Stripe-Webhook: keine Assessment-Session gefunden für", sessionId);
    return;
  }
  const updated: AssessmentSession = { ...existing, status: "paid", paidAt: Date.now() };
  await getRedis().set(sessionKey(sessionId), updated, { ex: SESSION_TTL_SECONDS });
}

export async function deleteAssessmentSession(sessionId: string): Promise<void> {
  await getRedis().del(sessionKey(sessionId));
}
