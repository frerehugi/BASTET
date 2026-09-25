import { Redis } from "@upstash/redis";

// Gleiche Vercel-Marketplace-Eigenheit wie lib/telegramSession.ts/lib/reviewQueue.ts:
// die UPSTASH_REDIS-Integration mit Custom-Prefix legt UPSTASH_REDIS_KV_REST_API_URL/
// _TOKEN an, nicht die von Redis.fromEnv() erwarteten Namen.
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

/**
 * Rein anonyme Nutzungszähler (Web- und Doc-Arm; Telegram vorerst nicht
 * mitgezählt) - zwei einfache Redis-INCR-Zähler pro Arm, "started" und
 * "completed". Kein IP, keine chat_id, keine sonstige Kennung wird
 * gespeichert; die Zahlen sagen nur "wie oft insgesamt", nie "von wem".
 * "started" minus "completed" ergibt später die Abbruchrate.
 */
export type UserCountArm = "web" | "doc";

function startedKey(arm: UserCountArm): string {
  return `bastet:usercount:${arm}:started`;
}

function completedKey(arm: UserCountArm): string {
  return `bastet:usercount:${arm}:completed`;
}

/**
 * "started" = erster tatsächlicher Backend-Call einer Sitzung (Web: erster
 * /api/chat-Call, turnCount 0 - die vorgelagerte Tier-1-Triage läuft rein
 * clientseitig, siehe app/page.tsx; Doc: jeder /api/doc-Call, da der
 * Doc-Arm keine Mehrfachrunden kennt). Fire-and-forget: ein Zählfehler
 * (z. B. Redis kurzzeitig nicht erreichbar) darf die eigentliche Anfrage
 * nie blockieren oder scheitern lassen.
 */
export async function incrementStarted(arm: UserCountArm): Promise<void> {
  try {
    await getRedis().incr(startedKey(arm));
  } catch (error) {
    console.error(`Usercount (${arm}:started) konnte nicht erhöht werden:`, error);
  }
}

/** Gleiches Fire-and-forget-Prinzip wie incrementStarted() - siehe dort. */
export async function incrementCompleted(arm: UserCountArm): Promise<void> {
  try {
    await getRedis().incr(completedKey(arm));
  } catch (error) {
    console.error(`Usercount (${arm}:completed) konnte nicht erhöht werden:`, error);
  }
}

export interface UserCounts {
  web: { started: number; completed: number };
  doc: { started: number; completed: number };
}

/** Für den Admin-Stats-Überblick (siehe lib/adminCommands.ts, /stats). */
export async function getUserCounts(): Promise<UserCounts> {
  const redis = getRedis();
  const [webStarted, webCompleted, docStarted, docCompleted] = await Promise.all([
    redis.get<number>(startedKey("web")),
    redis.get<number>(completedKey("web")),
    redis.get<number>(startedKey("doc")),
    redis.get<number>(completedKey("doc")),
  ]);
  return {
    web: { started: webStarted ?? 0, completed: webCompleted ?? 0 },
    doc: { started: docStarted ?? 0, completed: docCompleted ?? 0 },
  };
}
