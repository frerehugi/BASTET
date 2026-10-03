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
 * 3,0 USAT pro Aufruf (3000000 Basiseinheiten bei 6 Dezimalstellen) - seit
 * 03.10.2026, siehe build/x402-kosten-nutzen-2026.md Abschnitt 3. Der
 * ursprüngliche Preis (0,1 USAT, ~86% Marge gegen ~0,014 $ Kosten) war
 * gegen eine seither um Faktor ~3,7 gewachsene Wissensbasis und ein
 * verviervachtes maxTokens-Limit kalkuliert und damit überholt: reale
 * Kosten liegen bei ~0,05 $/Aufruf (Cache warm) bis ~0,74 $/Aufruf
 * (Cache kalt - kein anderer Arm war in der letzten Stunde aktiv). Preis
 * bewusst gegen den Cold-Fall kalkuliert (selbsttragend auch ohne warmen
 * Cache), kaufmännische Faustregel Preis = 4x Kosten zur Deckung von
 * Steuern/Infrastruktur-Overhead: 0,736 $ x 4 ≈ 2,94 $ -> 3,00 USAT.
 * Override via Env-Var für Preis-Tuning ohne Code-Änderung.
 */
function getPriceAmount(): string {
  return process.env.X402_PRICE_BASE_UNITS || String(Math.round(3.0 * 10 ** ASSETS.USAT.decimals));
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
        "BASTET expat consult: English-language orientation on Post-COVID/ME-CFS in German social law (GdB/MdE/EMR), grounded in a curated German legal/medical knowledge base.",
    },
  };
}
