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

// Reine Roundtrip-Korrelation für EINEN Verifizierungsversuch - kein
// Langzeit-Nutzerprofil, keine Gesundheitsangaben. Verknüpft die
// `externalUuid`, die BASTET beim Anlegen der Self-Session selbst vergibt,
// mit dem Ergebnis, das später per Webhook hereinkommt (app/api/self/webhook),
// damit die Person nach der Rückleitung von Self (app/page.tsx) erfährt, ob
// die Verifizierung tatsächlich bestanden wurde - der Redirect selbst ist
// nicht vertrauenswürdig, nur der Svix-signierte Webhook ist es.
//
// TTL bewusst kurz (30 Minuten): deutlich länger als die 15 Minuten
// Session-Gültigkeit bei Self (lib/self.ts), aber kein Grund, das darüber
// hinaus zu behalten - der Nullifier selbst (für die künftige, noch nicht
// umgesetzte 9c-Cooldown-Prüfung) wird hier nur durchgereicht, nicht
// dauerhaft an diesem Schlüssel gespeichert.
const TTL_SECONDS = 30 * 60;

export type SelfSessionStatus =
  | { status: "pending" }
  | { status: "valid"; nullifier: string | null }
  | { status: "invalid"; reason?: string };

function sessionKey(externalUuid: string): string {
  return `bastet:self:session:${externalUuid}`;
}

export async function markSelfSessionValid(externalUuid: string, nullifier: string | null): Promise<void> {
  await getRedis().set(
    sessionKey(externalUuid),
    { status: "valid", nullifier } satisfies SelfSessionStatus,
    { ex: TTL_SECONDS }
  );
}

export async function markSelfSessionInvalid(externalUuid: string, reason?: string): Promise<void> {
  await getRedis().set(sessionKey(externalUuid), { status: "invalid", reason } satisfies SelfSessionStatus, {
    ex: TTL_SECONDS,
  });
}

/** "pending" ist der Default, solange noch kein Webhook zu dieser externalUuid eingetroffen ist. */
export async function getSelfSessionStatus(externalUuid: string): Promise<SelfSessionStatus> {
  const existing = await getRedis().get<SelfSessionStatus>(sessionKey(externalUuid));
  return existing ?? { status: "pending" };
}
