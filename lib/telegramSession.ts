import { Redis } from "@upstash/redis";
import type { ChatMessage } from "./anthropic";

// Redis.fromEnv() erwartet UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN,
// aber die Vercel-Marketplace-Integration mit Custom-Prefix "UPSTASH_REDIS"
// legt stattdessen UPSTASH_REDIS_KV_REST_API_URL / ..._TOKEN an (Vercels
// alte KV-Namenskonvention, nicht Upstashs eigene) — daher explizit statt
// über fromEnv() konstruieren. Lazy statt Modul-Top-Level, damit ein fehlender
// Wert erst beim tatsächlichen Request auffällt (klare Fehlermeldung), nicht
// schon beim Import/Build (z. B. lokal ohne die Vercel-Env-Variablen).
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

// 60 Minuten Inaktivität -> Auto-Löschung. Kein dauerhaftes Speichern über
// diese TTL hinaus, keine Verknüpfung mit einer Identität außerhalb der
// Telegram chat_id selbst.
const SESSION_TTL_SECONDS = 60 * 60;

export interface TelegramSession {
  messages: ChatMessage[];
  diagnosisConfirmed: boolean | null;
  turnCount: number;
}

function sessionKey(chatId: number): string {
  return `bastet:tg:${chatId}`;
}

function emptySession(): TelegramSession {
  return { messages: [], diagnosisConfirmed: null, turnCount: 0 };
}

export async function getSession(chatId: number): Promise<TelegramSession> {
  const existing = await getRedis().get<TelegramSession>(sessionKey(chatId));
  return existing ?? emptySession();
}

export async function saveSession(chatId: number, session: TelegramSession): Promise<void> {
  await getRedis().set(sessionKey(chatId), session, { ex: SESSION_TTL_SECONDS });
}
