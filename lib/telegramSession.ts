import { Redis } from "@upstash/redis";
import type { ChatMessage } from "./anthropic";

const redis = Redis.fromEnv();

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
  const existing = await redis.get<TelegramSession>(sessionKey(chatId));
  return existing ?? emptySession();
}

export async function saveSession(chatId: number, session: TelegramSession): Promise<void> {
  await redis.set(sessionKey(chatId), session, { ex: SESSION_TTL_SECONDS });
}
