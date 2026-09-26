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

// Ein-/Ausschalter für die Self-Verifizierung (build/phase9-bastet-2.0-
// self-gatekeeper.md, 9b). Explizit als eigener, sehr einfacher Schalter
// gebaut, unabhängig vom Rest der Self-Integration - Ziel ist, dass "schalte
// Self aus" BASTET ohne Codeänderung/Deploy exakt in den heutigen Zustand
// zurückversetzt.
//
// Fail-safe-Prinzip (zieht sich durch die ganze Self-Integration): Fehlt
// eine der drei nötigen Umgebungsvariablen ODER lässt sich der Redis-Schalter
// nicht lesen, gilt Self als AUS - nie als AN. Ein Konfigurationsfehler oder
// ein Redis-Ausfall darf niemals dazu führen, dass Nutzer:innen ungewollt vor
// einer kaputten Verifizierung stehen; im Zweifel läuft BASTET so, wie es vor
// dieser Integration lief.
const FLAG_KEY = "bastet:self:enabled";

/** true, wenn alle für einen produktiven Self-Aufruf nötigen Secrets gesetzt sind. */
export function hasSelfConfig(): boolean {
  return Boolean(process.env.SELF_API_KEY && process.env.SELF_FLOW_ID && process.env.SELF_WEBHOOK_SECRET);
}

/**
 * Effektiver Schalterzustand: nur dann true, wenn sowohl die Konfiguration
 * vollständig ist ALS AUCH der Redis-Schalter explizit auf "on" steht. Siehe
 * Fail-safe-Prinzip oben - jeder Fehlerfall liefert false.
 */
export async function isSelfEnabled(): Promise<boolean> {
  if (!hasSelfConfig()) return false;
  try {
    const value = await getRedis().get<string>(FLAG_KEY);
    return value === "on";
  } catch (error) {
    console.error("Self-Schalter konnte nicht gelesen werden, falle zurück auf 'aus':", error);
    return false;
  }
}

/** Nur der reine Redis-Schalterzustand, ohne Konfigurationsprüfung - für die Statusanzeige im Admin-Kanal. */
export async function getSelfToggleState(): Promise<"on" | "off"> {
  try {
    const value = await getRedis().get<string>(FLAG_KEY);
    return value === "on" ? "on" : "off";
  } catch (error) {
    console.error("Self-Schalter konnte nicht gelesen werden:", error);
    return "off";
  }
}

export async function setSelfEnabled(enabled: boolean): Promise<void> {
  await getRedis().set(FLAG_KEY, enabled ? "on" : "off");
}
