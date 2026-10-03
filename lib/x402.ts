/**
 * x402-Facilitator-Setup für den Celo-gehosteten Facilitator
 * (https://x402.celo.org) — schützt app/api/x402/[[...route]]/route.ts.
 *
 * Gebaut direkt gegen die offizielle, vom Nutzer bereitgestellte Skill-
 * Dokumentation (x402-celo-facilitator, MIT, Celo Core Co.) - nicht mehr
 * gegen eigene Vermutungen über die REST-Ebene (frühere Fassung dieser
 * Datei rief /verify und /settle direkt auf; die Skill-Doku nennt das
 * explizit einen Fehler: "Calling the facilitator's /verify or /settle
 * directly and hand-building the payment body... Use the middleware").
 * Pakete real installiert und gegen die tatsächlichen .d.ts-Dateien
 * geprüft (@x402/core 2.28.0, @x402/hono 2.28.0, @x402/evm 2.28.0,
 * registry.npmjs.org ist - anders als x402.celo.org/docs.celo.org - aus
 * dieser Sandbox erreichbar).
 *
 * Bewusst Celo MAINNET (eip155:42220), nicht Testnet - der Hackathon
 * ("Agents on Open Rails", Track 2b) zählt nur reale USAT-Zahlungen fürs
 * Leaderboard.
 */

import { HTTPFacilitatorClient, x402ResourceServer, type RoutesConfig } from "@x402/core/server";
import type { Network } from "@x402/core/types";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { getAddress } from "viem";

const MAINNET_NETWORK: Network = "eip155:42220"; // Celo Mainnet
const TESTNET_NETWORK: Network = "eip155:11142220"; // Celo Sepolia

/**
 * USAT (Tether America USD) auf Celo Mainnet - Adresse, Dezimalstellen und
 * EIP-712-Domain (`extra.name`/`extra.version`) exakt aus der vom Nutzer
 * bereitgestellten Skill-Tabelle übernommen (`extra.name` ist NICHT das
 * Symbol - USAT signiert als "Tether America USD", siehe dortiger Hinweis).
 * USDC/USDT zum Vergleich ebenfalls hinterlegt, falls der Preis je nach
 * Celo-Builders-Vorgabe auf ein anderes Asset umgestellt werden muss.
 */
export const ASSETS = {
  USAT: {
    address: getAddress("0xD2ab3C9A02DBBAB236BfEC45D1d755DF4267F771"),
    decimals: 6,
    name: "Tether America USD",
    version: "1",
  },
  USDC: {
    address: getAddress("0xcebA9300f2b948710d2653dD7B07f33A8B32118C"),
    decimals: 6,
    name: "USDC",
    version: "2",
  },
  USDT: {
    address: getAddress("0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e"),
    decimals: 6,
    name: "Tether USD",
    version: "1",
  },
} as const;

function getNetwork(): Network {
  // X402_NETWORK=testnet schaltet auf Celo Sepolia um - Default bleibt
  // Mainnet (explizite Entscheidung, siehe Datei-Header).
  return process.env.X402_NETWORK === "testnet" ? TESTNET_NETWORK : MAINNET_NETWORK;
}

function getFacilitatorUrl(): string {
  return process.env.X402_NETWORK === "testnet" ? "https://api.x402.sepolia.celo.org" : "https://api.x402.celo.org";
}

function getApiKey(): string {
  const key = process.env.X402_API_KEY;
  if (!key) {
    throw new Error("X402_API_KEY ist nicht gesetzt (x402.celo.org-Dashboard, Vercel Environment Variables).");
  }
  return key;
}

function getPayTo(): `0x${string}` {
  // Default: die bereits unter ERC-8004 (Agent-IDs 9817/9818) registrierte
  // BASTET-Wallet (siehe lib/content.ts, BASTET_WALLET_ADDRESS).
  return getAddress(process.env.SELLER_PAY_TO || "0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608");
}

/**
 * 4,99 USAT pro Aufruf (4990000 Basiseinheiten bei 6 Dezimalstellen) - seit
 * 03.10.2026, siehe build/x402-kosten-nutzen-2026.md Abschnitt 3. Erst auf
 * 3,00 USAT kalkuliert (kaufmännische 4x-Regel auf die realen Cold-Cache-
 * Kosten von ~0,736 $/Aufruf, ~6,8x statt nur 4x), dann bewusst auf den
 * runden Preis 4,99 USAT angehoben - zusätzliche Sicherheitsmarge (der
 * Endpunkt muss sich auch ohne warmen Prompt-Cache selbst tragen, siehe
 * dortige Begründung) und ein klarerer, leichter kommunizierbarer Preis
 * fürs Infopaket (buildInfoPacket() unten). Override via Env-Var für
 * Preis-Tuning ohne Code-Änderung.
 */
function getPriceAmount(): string {
  return process.env.X402_PRICE_BASE_UNITS || String(Math.round(4.99 * 10 ** ASSETS.USAT.decimals));
}

export const facilitator = new HTTPFacilitatorClient({
  url: getFacilitatorUrl(),
  createAuthHeaders: async () => {
    const h = { "X-API-Key": getApiKey() };
    return { verify: h, settle: h, supported: h };
  },
});

export const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register("eip155:*", new ExactEvmScheme());

export const CONSULT_PATH = "/api/x402/consult";

/**
 * Route-Konfiguration für paymentMiddleware() - genau EIN geschützter
 * Pfad (der englische Expat-Consult, siehe lib/expatConsult.ts). `payTo`
 * und `price` liegen bewusst INNERHALB von `accepts`, nicht als separate
 * Parameter (v2-API-Form, siehe Skill-Doku - die ältere v1-Form
 * `paymentMiddleware(payTo, routes, facilitator)` ist dort explizit als
 * Fehler aufgeführt).
 */
export function buildRoutes(): RoutesConfig {
  return {
    [`POST ${CONSULT_PATH}`]: {
      accepts: [
        {
          scheme: "exact",
          network: getNetwork(),
          payTo: getPayTo(),
          price: {
            amount: getPriceAmount(),
            asset: ASSETS.USAT.address,
            extra: { name: ASSETS.USAT.name, version: ASSETS.USAT.version },
          },
        },
      ],
      description:
        "BASTET expat consult: English-language orientation on Post-COVID/ME-CFS in German social law (GdB/MdE/EMR), grounded in a curated German legal/medical knowledge base. GET this same URL (no payment) for a full service description and pricing.",
    },
  };
}

/**
 * Agent-lesbares Infopaket, über GET auf demselben Pfad OHNE Zahlung
 * erreichbar (buildRoutes() oben schützt nur "POST {CONSULT_PATH}" - ein
 * GET auf denselben Pfad matcht die Middleware nicht). Zweck: der
 * aufrufende Agent trifft die Kaufentscheidung laut Nutzervorgabe
 * typischerweise NICHT allein, sondern bespricht sie mit dem
 * Wallet-Besitzer - deshalb bewusst als Fließtext-taugliche Felder
 * aufgebaut (nicht nur technische Metadaten), die sich direkt an einen
 * Menschen weiterreichen lassen. Ergänzt (nicht ersetzt) die rein
 * protokollseitigen PaymentRequirements aus dem 402-Response.
 * Preis/Nutzungsmodell siehe build/x402-kosten-nutzen-2026.md Abschnitt 3.
 */
export function buildInfoPacket() {
  return {
    service: "BASTET",
    greeting:
      "Hi — I'm BASTET, an AI orientation service for English-speaking expats in Germany dealing with Post-COVID or ME/CFS (chronic fatigue syndrome) in German disability law.",
    description:
      "BASTET explains how Post-COVID/ME-CFS is assessed under German disability law: Degree of Disability (Grad der Behinderung, GdB), Occupational Disability (Minderung der Erwerbsfähigkeit, MdE) under statutory accident insurance, and Disability Pension (Erwerbsminderungsrente, EMR). Every answer is grounded in a curated set of German legal and medical primary sources (official assessment regulations, court decisions, clinical guidelines) and cites them with numbered references.",
    price: {
      amount: "4.99",
      asset: "USAT",
      assetFullName: ASSETS.USAT.name,
      network: "Celo Mainnet (eip155:42220)",
    },
    whatYouGet:
      "One complete, written, English-language answer to one question — structured by GdB/MdE/EMR where relevant, with numbered references back to the specific source for each claim. Not a generic AI guess: the answer is grounded in BASTET's curated knowledge base, not general training knowledge.",
    usageModel:
      "Single-use, not a subscription or time-limited access: one payment of 4.99 USAT = one question = one answer. There is no ongoing session or conversation tied to a payment — a follow-up question needs a new request and a new payment. This is the same every time; the price does not buy multiple questions or a time window.",
    whatItCanNotDo: [
      "Does not diagnose — it only works with what you describe, no hidden assumptions.",
      "The answer is AI-generated and non-binding: it does not replace a medical examination, a decision by a German authority or court, or advice from a lawyer specializing in German social law (Fachanwalt/-anwältin für Sozialrecht).",
      "Only covers Post-COVID/ME-CFS and German disability law — not visas, residency registration, taxes, or other expat bureaucracy topics.",
      "Does not store the question or answer beyond processing that one request (no account, no history).",
    ],
    forCallingAgents:
      "If you are an AI agent spending on behalf of a human wallet owner: please relay this information to them before paying, so they understand this is a one-time, non-binding orientation — not legal or medical advice — before you spend their USAT.",
    howToPay: `POST to this same URL (${CONSULT_PATH}) with a JSON body {"question": "..."} and no payment header to receive the HTTP 402 challenge with the exact on-chain payment requirements (scheme, network, asset, payTo, amount).`,
  };
}
