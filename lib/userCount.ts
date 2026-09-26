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
 * Rein anonyme Nutzungszähler (Web-, Doc- und Telegram-Arm) - zwei einfache
 * Redis-INCR-Zähler pro Arm, "started" und "completed". Kein IP, keine
 * chat_id, keine sonstige Kennung wird gespeichert; die Zahlen sagen nur
 * "wie oft insgesamt", nie "von wem". "started" minus "completed" ergibt
 * später die Abbruchrate.
 */
// "landing": Klick auf den "Starte BASTET"-Button (app/page.tsx) - der
// früheste trackbare Schritt im gesamten Web-Arm, noch VOR der Diagnose-
// Gate-/Warnhinweis-Frage. Nur "started" wird hier je gesetzt (ein Klick ist
// ein einmaliges Ereignis, kein "completed" im eigentlichen Sinn) - siehe
// handleStats() in lib/adminCommands.ts, das tier1:started stattdessen als
// den "wie viele kamen wirklich bis Tier 1"-Vergleichswert nutzt.
export type UserCountArm = "web" | "doc" | "telegram" | "tier1" | "landing";

const ARMS: UserCountArm[] = ["web", "doc", "telegram", "tier1", "landing"];

function startedKey(arm: UserCountArm): string {
  return `bastet:usercount:${arm}:started`;
}

function completedKey(arm: UserCountArm): string {
  return `bastet:usercount:${arm}:completed`;
}

/**
 * "started" = erster tatsächlicher Backend-Call einer Sitzung (Web: erster
 * /api/chat-Call, turnCount 0; Doc: jeder /api/doc-Call, da der Doc-Arm keine
 * Mehrfachrunden kennt). Ausnahme "tier1": Tier 1 läuft rein clientseitig
 * (kein API-Call, kein Token-Verbrauch, siehe app/TriageFlow.tsx) - "started"/
 * "completed" kommen hier über den einzigen dafür nötigen Netzwerk-Call
 * (app/api/track-tier1) rein, damit build/phase9-…-self-gatekeeper.md
 * Abschnitt "Tier-1-Qualität" überhaupt messen kann, wie viele Nutzer:innen
 * Tier 1 abschließen - unabhängig davon, ob sie danach zu Tier 2 wechseln.
 * Fire-and-forget: ein Zählfehler (z. B. Redis kurzzeitig nicht erreichbar)
 * darf die eigentliche Anfrage nie blockieren oder scheitern lassen.
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

/**
 * Direktes Setzen (kein INCR) - NUR für die einmalige rückwirkende Tier-1-
 * Korrektur gedacht (lib/adminCommands.ts, Befehl "backfill tier1"), sonst
 * nirgends aufrufen: jeder normale Zähl-Vorgang läuft über
 * incrementStarted()/incrementCompleted() oben, damit kein Turn versehentlich
 * einen ganzen Zählerstand überschreibt statt ihn nur zu erhöhen.
 */
export async function setStartedCount(arm: UserCountArm, value: number): Promise<void> {
  await getRedis().set(startedKey(arm), value);
}

export async function setCompletedCount(arm: UserCountArm, value: number): Promise<void> {
  await getRedis().set(completedKey(arm), value);
}

export type UserCounts = Record<UserCountArm, { started: number; completed: number }>;

/** Für den Admin-Stats-Überblick (siehe lib/adminCommands.ts, /stats). */
export async function getUserCounts(): Promise<UserCounts> {
  const redis = getRedis();
  const perArm = await Promise.all(
    ARMS.map(async (arm) => {
      const [started, completed] = await Promise.all([
        redis.get<number>(startedKey(arm)),
        redis.get<number>(completedKey(arm)),
      ]);
      return [arm, { started: started ?? 0, completed: completed ?? 0 }] as const;
    })
  );
  return Object.fromEntries(perArm) as UserCounts;
}
