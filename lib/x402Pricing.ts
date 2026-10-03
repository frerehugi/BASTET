import { Redis } from "@upstash/redis";

/**
 * Pro-Wallet "zuletzt bezahlt"-Zustand für die zweistufige x402-Preisstruktur
 * (siehe build/x402-kosten-nutzen-2026.md Abschnitt 3): voller Preis für eine
 * neue/lange nicht aktive Wallet, ermäßigter Preis für eine Folgefrage
 * derselben Wallet innerhalb von 55 Minuten - jede bezahlte Folgefrage
 * verlängert das Fenster erneut um 55 Minuten. 55 statt 60 Minuten bewusst
 * als Sicherheitsmarge VOR der 1h-Cache-TTL (siehe lib/x402.ts), damit der
 * günstige Preis nur dann gilt, wenn der geteilte Wissensbasis-Cache
 * nachweislich noch warm ist (diese Wallet hat ihn selbst innerhalb der
 * letzten 55 Min. gelesen/aufgefrischt - siehe TTL-Sliding-Window-Verhalten
 * in der Anthropic-Prompt-Caching-Doku).
 *
 * Bewusst NICHT aus einem Client-Hint vertraut - der Preis wird einzig aus
 * diesem server-seitigen Redis-Stand entschieden, der nur nach einer ECHTEN,
 * verifizierten Settlement geschrieben wird (resourceServer.onAfterSettle(),
 * siehe lib/x402.ts). Eine Wallet kann sich also nicht in die günstige Stufe
 * hineinbehaupten - der Query-Parameter, über den sich ein Client zu
 * erkennen gibt, ist nur ein Identifikator, keine vertrauenswürdige
 * Preisbehauptung: die tatsächliche Zahlung muss ohnehin mit der echten
 * Signatur dieser Wallet erfolgen.
 */

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

const RETURNING_WINDOW_SECONDS = 55 * 60;

function walletKey(address: string): string {
  return `bastet:x402:wallet:${address.toLowerCase()}`;
}

/**
 * true, wenn diese Wallet innerhalb der letzten 55 Minuten bereits eine
 * verifizierte Zahlung geleistet hat (= gilt für den ermäßigten Preis).
 * Best-effort: ein Redis-Ausfall darf die Preisbildung nie blockieren -
 * fällt dann auf "neue Wallet"/vollen Preis zurück (sicherer Fehlerfall,
 * nie umgekehrt - ein Ausfall darf niemals zu Unrecht den Rabatt gewähren).
 */
export async function isReturningWallet(address: string): Promise<boolean> {
  try {
    const seenAt = await getRedis().get<number>(walletKey(address));
    return seenAt !== null;
  } catch (error) {
    console.error("x402-Preisstufe: Redis-Lookup fehlgeschlagen, falle auf vollen Preis zurück:", error);
    return false;
  }
}

/**
 * Nach einer ECHTEN, verifizierten Settlement aufgerufen (nie vor der
 * Verifikation) - setzt/verlängert das 55-Minuten-Fenster für genau diese
 * Wallet. Best-effort: ein Fehler hier darf die bereits erfolgte Zahlung
 * nicht beeinträchtigen, nur beim nächsten Aufruf fehlt dann ggf. der
 * Rabatt (konservativer Fehlerfall).
 */
export async function touchReturningWallet(address: string): Promise<void> {
  try {
    await getRedis().set(walletKey(address), Date.now(), { ex: RETURNING_WINDOW_SECONDS });
  } catch (error) {
    console.error("x402-Preisstufe: Redis-Schreibvorgang fehlgeschlagen:", error);
  }
}
