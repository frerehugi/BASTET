import { Redis } from "@upstash/redis";

// Gleiche Vercel-Marketplace-Eigenheit wie lib/telegramSession.ts: die
// UPSTASH_REDIS-Integration mit Custom-Prefix legt UPSTASH_REDIS_KV_REST_API_URL/
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

const FINGERPRINT_PREFIX = "bastet:update-check:";
const PENDING_KEY = "bastet:review:pending";
const LOG_KEY = "bastet:review:log";
const ADDENDUM_KEY = "bastet:knowledge:addendum";

const LOG_MAX_ENTRIES = 200;

export interface PendingItem {
  id: string;
  sourceId: string;
  sourceLabel: string;
  sourceUrl: string;
  summary: string;
  detectedAt: number;
}

export interface LogEntry extends PendingItem {
  status: "approved" | "rejected";
  resolvedAt: number;
  reason?: string;
}

export interface AddendumItem {
  id: string;
  sourceLabel: string;
  sourceUrl: string;
  summary: string;
  approvedAt: number;
}

export async function getLastFingerprint(sourceId: string): Promise<string | null> {
  const value = await getRedis().get<string>(FINGERPRINT_PREFIX + sourceId);
  return value ?? null;
}

export async function setLastFingerprint(sourceId: string, fingerprint: string): Promise<void> {
  await getRedis().set(FINGERPRINT_PREFIX + sourceId, fingerprint);
}

export async function getPendingItems(): Promise<PendingItem[]> {
  const items = await getRedis().get<PendingItem[]>(PENDING_KEY);
  return items ?? [];
}

export async function addPendingItem(item: PendingItem): Promise<void> {
  const items = await getPendingItems();
  items.push(item);
  await getRedis().set(PENDING_KEY, items);
}

async function removePendingItem(id: string): Promise<PendingItem | null> {
  const items = await getPendingItems();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;
  const [removed] = items.splice(index, 1);
  await getRedis().set(PENDING_KEY, items);
  return removed;
}

async function appendLog(entry: LogEntry): Promise<void> {
  const redis = getRedis();
  const existing = (await redis.get<LogEntry[]>(LOG_KEY)) ?? [];
  existing.push(entry);
  // Kein Eintrag wird stillschweigend verworfen - aber der Log selbst bleibt
  // begrenzt, damit er nicht unbegrenzt wächst; älteste zuerst gekappt.
  const trimmed = existing.length > LOG_MAX_ENTRIES ? existing.slice(existing.length - LOG_MAX_ENTRIES) : existing;
  await redis.set(LOG_KEY, trimmed);
}

export async function getLog(): Promise<LogEntry[]> {
  const entries = await getRedis().get<LogEntry[]>(LOG_KEY);
  return entries ?? [];
}

async function appendAddendum(item: AddendumItem): Promise<void> {
  const redis = getRedis();
  const existing = (await redis.get<AddendumItem[]>(ADDENDUM_KEY)) ?? [];
  existing.push(item);
  await redis.set(ADDENDUM_KEY, existing);
}

/**
 * Text-Repräsentation der freigegebenen Aktualisierungen, angehängt an die
 * statische Wissensbasis (siehe lib/knowledgeBase.ts). Leerer String, falls
 * noch nichts freigegeben wurde - dann bleibt das Verhalten unverändert zum
 * rein statischen Stand.
 */
export async function getApprovedAddendumText(): Promise<string> {
  const items = (await getRedis().get<AddendumItem[]>(ADDENDUM_KEY)) ?? [];
  if (items.length === 0) return "";
  return items
    .map((item) => {
      const date = new Date(item.approvedAt).toISOString().slice(0, 10);
      return `- [${date}, freigegeben] ${item.summary} (Quelle: ${item.sourceLabel}, ${item.sourceUrl})`;
    })
    .join("\n");
}

export async function approvePendingItem(id: string): Promise<PendingItem | null> {
  const item = await removePendingItem(id);
  if (!item) return null;
  const resolvedAt = Date.now();
  await appendLog({ ...item, status: "approved", resolvedAt });
  await appendAddendum({
    id: item.id,
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl,
    summary: item.summary,
    approvedAt: resolvedAt,
  });
  return item;
}

export async function rejectPendingItem(id: string, reason?: string): Promise<PendingItem | null> {
  const item = await removePendingItem(id);
  if (!item) return null;
  await appendLog({ ...item, status: "rejected", resolvedAt: Date.now(), reason });
  return item;
}
