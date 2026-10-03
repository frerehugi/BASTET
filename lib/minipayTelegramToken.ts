/**
 * Verifiziert eine MiniPay-Zahlung (bastet.osirisapp.xyz, siehe OSIRIS-Repo
 * apis/bastet-pay) und schaltet bei Erfolg den 6h-Tier-2-Zugang für die
 * zahlende Telegram chat_id frei. Eigener, einfacher Zahlungsweg nur für
 * MiniPay - KEINE Wiederverwendung von lib/x402.ts/@x402/*: MiniPay kann kein
 * personal_sign/eth_signTypedData (siehe build/minipay-machbarkeit-2026.md),
 * x402s EIP-3009-"exact"-Schema fällt damit aus. Hier stattdessen eine
 * normale ERC-20-transfer()-Transaktion, server-seitig on-chain verifiziert.
 *
 * WICHTIG: Dieses Modul setzt nur das Redis-Flag (accessKey unten). Es
 * ändert NICHT, ob app/api/telegram/route.ts den Tier-2-Zugang tatsächlich
 * davon abhängig macht - diese Verdrahtung ist ein separater, noch nicht
 * gemachter Schritt (siehe README.md-Abschnitt dazu). Bis dahin ist dieser
 * Mechanismus folgenlos aktiv, aber wirkungslos.
 */

import { createPublicClient, fallback, http, getAddress, isAddressEqual, parseEventLogs, type Hash } from "viem";
import { celo } from "viem/chains";
import { Redis } from "@upstash/redis";

let cachedRedis: Redis | null = null;
function getRedis(): Redis {
  if (cachedRedis) return cachedRedis;
  const url = process.env.UPSTASH_REDIS_KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("UPSTASH_REDIS_KV_REST_API_URL/_TOKEN sind auf dem Server nicht gesetzt (Vercel Environment Variables).");
  }
  cachedRedis = new Redis({ url, token });
  return cachedRedis;
}

// Gleiche zwei Endpunkte wie src/minipayWallet.ts im OSIRIS-Repo (dort
// ausführlich begründet: forno.celo.org fällt unter Last öfter mit einem
// undifferenzierten Fehler aus, fallback() wechselt dann automatisch). Kein
// Env-Var nötig, daher als Modul-Top-Level-Konstante statt lazy wie getRedis().
const publicClient = createPublicClient({
  chain: celo,
  transport: fallback([http("https://forno.celo.org"), http("https://rpc.ankr.com/celo")]),
});

// USDT Celo Mainnet - dieselbe Adresse wie src/config.ts (INPUT_TOKENS_BY_CHAIN.
// mainnet.USDT) und apis/bastet-pay/src/config.ts im OSIRIS-Repo, dort gegen
// name()/symbol()/decimals() verifiziert.
export const USDT_ADDRESS = getAddress("0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e");
const USDT_DECIMALS = 6;

// 4,99 USDT statt der ursprünglich angedachten 4,99 USAT - MiniPay listet/
// unterstützt zuverlässig nur USDT (celopedia-skill, minipay-guide.md Regel
// 4), x402s USAT-Preis (lib/x402.ts) ist ein komplett anderer Zahlungsweg.
export const PRICE_USDT_BASE_UNITS = BigInt(Math.round(4.99 * 10 ** USDT_DECIMALS));
const ACCESS_WINDOW_SECONDS = 6 * 60 * 60;

// Dieselbe Default-Empfängerwallet wie lib/x402.ts getPayTo() (dort privat,
// deshalb hier dupliziert statt importiert) - beide Zahlungswege sollen im
// selben Wallet zusammenlaufen. Teilt sich dieselbe SELLER_PAY_TO-Env-Var.
function getReceiverAddress() {
  return getAddress(process.env.SELLER_PAY_TO || "0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608");
}

function accessKey(chatId: number): string {
  return `bastet:tg:tier2paid:${chatId}`;
}

function txUsedKey(txHash: string): string {
  return `bastet:tg:minipay:tx:${txHash.toLowerCase()}`;
}

const TRANSFER_EVENT = {
  type: "event",
  name: "Transfer",
  inputs: [
    { name: "from", type: "address", indexed: true },
    { name: "to", type: "address", indexed: true },
    { name: "value", type: "uint256", indexed: false },
  ],
} as const;

/**
 * true, wenn chat_id gerade einen bezahlten Zugang hat (siehe accessKey
 * oben) - für die künftige Verdrahtung in app/api/telegram/route.ts, bislang
 * von niemandem aufgerufen (siehe Datei-Kommentar oben).
 */
export async function hasMiniPayAccess(chatId: number): Promise<boolean> {
  try {
    const value = await getRedis().get<string>(accessKey(chatId));
    return value !== null;
  } catch (error) {
    console.error("MiniPay-Zugangs-Check fehlgeschlagen, falle auf 'kein Zugang' zurück:", error);
    return false;
  }
}

// Der Client (apis/bastet-pay) wartet bereits selbst auf die Transaktions-
// Bestätigung, bevor er diese Route aufruft - trotzdem kurzer Retry, falls
// der hier genutzte RPC-Knoten die Quittung noch nicht propagiert hat.
async function getReceiptWithRetry(hash: Hash) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await publicClient.getTransactionReceipt({ hash });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Transaktionsquittung nicht gefunden.");
}

/**
 * Prüft txHash on-chain (echte USDT-transfer()-Transaktion an die
 * Empfängerwallet, Betrag >= Preis) und schaltet bei Erfolg den 6h-Zugang
 * für chatId frei. Wirft bei jedem Verifikationsfehler eine Error mit
 * nutzerverständlicher Meldung (siehe app/api/telegram/minipay-verify/route.ts).
 *
 * Replay-Schutz: derselbe txHash kann nur EINMAL einen Zugang freischalten
 * (atomarer Redis-SETNX, erst nach erfolgreicher Verifikation - ein
 * fehlgeschlagener Verifikationsversuch verbraucht den Hash nicht).
 */
export async function verifyMiniPayPaymentAndGrantAccess(
  chatId: number,
  txHash: string
): Promise<{ expiresAt: string }> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("Ungültiger Transaktions-Hash.");
  }

  const receipt = await getReceiptWithRetry(txHash as Hash);
  if (receipt.status !== "success") {
    throw new Error("Die Transaktion war on-chain nicht erfolgreich (status: reverted).");
  }

  const receiver = getReceiverAddress();
  const transfers = parseEventLogs({ abi: [TRANSFER_EVENT], logs: receipt.logs, eventName: "Transfer" });
  const matching = transfers.find(
    (log) =>
      isAddressEqual(log.address, USDT_ADDRESS) &&
      isAddressEqual(log.args.to, receiver) &&
      log.args.value >= PRICE_USDT_BASE_UNITS
  );
  if (!matching) {
    throw new Error("Keine passende USDT-Zahlung (richtiger Betrag, richtige Empfängerwallet) in dieser Transaktion gefunden.");
  }

  const redis = getRedis();
  const claimed = await redis.set(txUsedKey(txHash), "1", { nx: true, ex: 7 * 24 * 60 * 60 });
  if (claimed === null) {
    throw new Error("Diese Transaktion wurde bereits für einen Zugang verwendet.");
  }

  const expiresAt = new Date(Date.now() + ACCESS_WINDOW_SECONDS * 1000);
  await redis.set(accessKey(chatId), expiresAt.toISOString(), { ex: ACCESS_WINDOW_SECONDS });
  return { expiresAt: expiresAt.toISOString() };
}
