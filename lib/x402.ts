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
import type { DynamicPrice, HTTPRequestContext } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { getAddress, isAddress } from "viem";
import { isReturningWallet, touchReturningWallet } from "./x402Pricing";

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
 * Zweistufige Preisstruktur (seit 03.10.2026, Nutzervorgabe - siehe
 * build/x402-kosten-nutzen-2026.md Abschnitt 3): voller Preis für eine neue
 * Wallet, ermäßigter Preis für eine Folgefrage DERSELBEN Wallet innerhalb
 * von 55 Minuten (jede Folgefrage verlängert das Fenster erneut) -
 * marketingseitig einfach zu kommunizieren und garantiert zugleich, dass
 * der ermäßigte Preis nur gilt, wenn der geteilte Wissensbasis-Cache
 * nachweislich noch warm ist (1h-TTL, 55 Min. Sicherheitsmarge, siehe
 * lib/x402Pricing.ts).
 *
 * Realer Preis (Begründung Abschnitt 1.3-3 im Kostendokument): neu
 * 4,99 USAT (~6,8x der realen Cold-Cache-Kosten von ~0,736 $), Folgefrage
 * 0,99 USAT (deckt die realen Warm-Kosten von ~0,11-0,17 $ komfortabel).
 *
 * TEMPORÄR GESENKT (03.10.2026) für mehrere BOTKOV-Testläufe gegen den
 * echten Facilitator - vor Produktivbetrieb bzw. nach Abschluss der
 * Testphase zurücksetzen. Je Stufe zusätzlich per Env-Var überschreibbar,
 * ohne Code-Änderung.
 */
function getNewWalletPriceAmount(): string {
  return process.env.X402_PRICE_NEW_BASE_UNITS || String(Math.round(0.1 * 10 ** ASSETS.USAT.decimals));
}

function getReturningWalletPriceAmount(): string {
  return process.env.X402_PRICE_RETURNING_BASE_UNITS || String(Math.round(0.05 * 10 ** ASSETS.USAT.decimals));
}

function toDisplay(baseUnits: string): string {
  return String(Number(baseUnits) / 10 ** ASSETS.USAT.decimals);
}

/**
 * Liest den `?wallet=0x...`-Query-Parameter. Reiner Identifikator, KEINE
 * vertrauenswürdige Preisbehauptung - der tatsächliche Preis entscheidet
 * sich allein über isReturningWallet() (lib/x402Pricing.ts), das nur nach
 * einer echten, verifizierten Settlement geschrieben wird. Ungültige/
 * fehlende Adresse -> null, fällt dann auf den vollen Preis zurück
 * (sicherer Default).
 *
 * WICHTIG: `context.path` enthält laut der tatsächlichen @x402/hono-
 * Adapter-Implementierung (node_modules/@x402/hono/dist/cjs/index.js,
 * getPath() -> c.req.path) NIEMALS den Query-String - ein erster Versuch,
 * den Hint per `new URL(context.path, ...)` zu parsen, konnte den
 * Parameter deshalb nie finden (realer Bug, per echtem Testlauf entdeckt:
 * der ermäßigte Preis griff trotz korrekt gesendetem ?wallet= nie). Richtig
 * ist `context.adapter.getQueryParam("wallet")` - eine von HTTPAdapter
 * optional deklarierte, von Hono tatsächlich implementierte Methode
 * (dieselbe Datei, getQueryParam() -> c.req.queries()).
 */
function extractWalletHint(context: HTTPRequestContext): string | null {
  const raw = context.adapter.getQueryParam?.("wallet");
  const hint = Array.isArray(raw) ? raw[0] : raw;
  return hint && isAddress(hint) ? getAddress(hint) : null;
}

/**
 * DynamicPrice (offizielle @x402/core-API, siehe PaymentOption.price:
 * Price | DynamicPrice) - wird von der Middleware pro Anfrage neu
 * aufgerufen, einmal beim Bau der 402-Antwort (Wallet ggf. noch unbekannt,
 * dann voller Preis) und erneut bei der Verifikation einer eingereichten
 * Zahlung (derselbe Query-Parameter wie beim 402-Request, konsistent).
 */
const computePrice: DynamicPrice = async (context) => {
  const wallet = extractWalletHint(context);
  const amount =
    wallet && (await isReturningWallet(wallet)) ? getReturningWalletPriceAmount() : getNewWalletPriceAmount();
  return {
    amount,
    asset: ASSETS.USAT.address,
    extra: { name: ASSETS.USAT.name, version: ASSETS.USAT.version },
  };
};

export const facilitator = new HTTPFacilitatorClient({
  url: getFacilitatorUrl(),
  createAuthHeaders: async () => {
    const h = { "X-API-Key": getApiKey() };
    return { verify: h, settle: h, supported: h };
  },
});

export const resourceServer = new x402ResourceServer(facilitator);
resourceServer.register("eip155:*", new ExactEvmScheme());

/**
 * Schreibt das 55-Minuten-Fenster für die zahlende Wallet NUR nach einer
 * echten, von der Middleware bereits verifizierten Settlement
 * (context.result.payer kommt aus der Facilitator-Antwort, nicht aus dem
 * Query-Parameter-Hint oben) - siehe lib/x402Pricing.ts-Header für die
 * Begründung, warum das die einzige vertrauenswürdige Quelle ist.
 */
resourceServer.onAfterSettle(async (context) => {
  if (context.result.success && context.result.payer) {
    await touchReturningWallet(context.result.payer);
  }
});

export const CONSULT_PATH = "/api/x402/consult";

/**
 * Route-Konfiguration für paymentMiddleware() - genau EIN geschützter
 * Pfad (der englische Expat-Consult, siehe lib/expatConsult.ts). `payTo`
 * und `price` liegen bewusst INNERHALB von `accepts`, nicht als separate
 * Parameter (v2-API-Form, siehe Skill-Doku - die ältere v1-Form
 * `paymentMiddleware(payTo, routes, facilitator)` ist dort explizit als
 * Fehler aufgeführt). `price` ist eine DynamicPrice-Funktion statt eines
 * festen Werts, siehe computePrice() oben.
 */
export function buildRoutes(): RoutesConfig {
  return {
    [`POST ${CONSULT_PATH}`]: {
      accepts: [
        {
          scheme: "exact",
          network: getNetwork(),
          payTo: getPayTo(),
          price: computePrice,
        },
      ],
      description:
        "BASTET expat consult: English-language orientation on Post-COVID/ME-CFS in German social law (GdB/MdE/EMR), grounded in a curated German legal/medical knowledge base. GET this same URL (no payment) for a full service description and pricing. Append ?wallet=0x... to get the returning-wallet price if eligible.",
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
 *
 * `howToAskAGoodQuestion` ist bewusst aus dem echten Tier-1-Fragenkatalog
 * (lib/triage/questions.ts) destilliert, nicht neu erfunden - derselbe
 * Kategorien-Satz (PEM, Dauer, Schmerz, Kognition, Autonomie, Schlaf,
 * Komorbiditäten, Medikation, Funktionskapazität, Alltag, Arbeitsfähigkeit,
 * objektive Tests, beruflicher Kontext), den auch computeTriage()
 * (lib/triage/scoring.ts) tatsächlich auswertet - nur als englischer
 * Freitext-Leitfaden statt als strukturiertes Frage-für-Frage-Formular,
 * weil der x402-Endpunkt (anders als der Web-Chat-Arm) nur ein einzelnes
 * `question`-Freitextfeld entgegennimmt und es - anders als dort - KEINE
 * Folgefrage gibt (siehe lib/expatConsult.ts: Single-Shot ohne Turn).
 */
export function buildInfoPacket() {
  return {
    service: "BASTET",
    greeting:
      "Hi — I'm BASTET, an AI orientation service for English-speaking expats in Germany dealing with Post-COVID or ME/CFS (chronic fatigue syndrome) in German disability law.",
    description:
      "BASTET explains how Post-COVID/ME-CFS is assessed under German disability law: Degree of Disability (Grad der Behinderung, GdB), Occupational Disability (Minderung der Erwerbsfähigkeit, MdE) under statutory accident insurance, and Disability Pension (Erwerbsminderungsrente, EMR). Every answer is grounded in a curated set of German legal and medical primary sources (official assessment regulations, court decisions, clinical guidelines) and cites them with numbered references.",
    price: {
      newWallet: toDisplay(getNewWalletPriceAmount()),
      returningWallet: toDisplay(getReturningWalletPriceAmount()),
      returningWindowMinutes: 55,
      asset: "USAT",
      assetFullName: ASSETS.USAT.name,
      network: "Celo Mainnet (eip155:42220)",
      howToGetTheReturningPrice: `Append ?wallet=0x... (your own paying wallet address) to the request URL (e.g. "${CONSULT_PATH}?wallet=0xYourAddress"). The discount only applies if that exact wallet already paid within the last 55 minutes - it is looked up server-side, not something you can claim; sending the parameter without being eligible simply gets you the new-wallet price.`,
    },
    whatYouGet:
      "One complete, written, English-language answer to one question — structured by GdB/MdE/EMR where relevant, with numbered references back to the specific source for each claim. Not a generic AI guess: the answer is grounded in BASTET's curated knowledge base, not general training knowledge.",
    howToAskAGoodQuestion: {
      why: "This is a single-shot consult with no follow-up turn — the quality of your answer depends entirely on how much detail is in your one question. Include as much of the following as applies to you; plain, everyday descriptions are fine, you don't need medical terminology. If you genuinely don't know something, say so rather than guessing.",
      coreCriteria: [
        "Post-exertional malaise (PEM): do you get a delayed worsening after physical, mental, or emotional exertion? If yes — what triggers it, how little exertion is enough to cause it, how soon it hits (immediately / after hours / 1–3 days later), and how long you typically need to recover (hours / days / over a week / over a month).",
        "Duration: have your symptoms been continuously present for more than 6 months?",
      ],
      symptoms: [
        "Pain: type (muscle, joint, new headaches, sore throat, tender lymph nodes), how widespread (localized / several body regions / nearly all over), and how much it limits you day to day.",
        "Cognitive/neurological symptoms: concentration problems, short-term memory issues, word-finding difficulty, slowed thinking, sensitivity to light or noise, coordination problems or noticeable muscle weakness.",
        "Autonomic symptoms: dizziness or racing heart on standing (and whether a heart-rate test like a Schellong or tilt-table test was ever done, and the result), temperature regulation problems, IBS-like gut symptoms, new infections or intolerances.",
        "Sleep: unrefreshing sleep despite enough time in bed, trouble falling or staying asleep, a disrupted day-night rhythm.",
        "Other: numbness/tingling/burning sensations (and whether combined with muscle weakness), breathing difficulty on exertion.",
      ],
      context: [
        "Comorbidities: a diagnosed diabetes (and how it's treated), or a separately, formally diagnosed psychiatric condition — distinct from understandable emotional distress reacting to the physical illness itself.",
        "Medication: what you currently take regularly for these symptoms, and whether it actually helps.",
        "Functional capacity: a Bell Score (0–100 scale) if you know it, or a FUNCAP27/FUNCAP55 score.",
        "Daily living: can you manage independently, do you need help with specific tasks, or are you largely housebound/bedbound?",
        "Work capacity: roughly how many hours a day of ANY light work on the general labor market feels realistic right now, independent of your previous job — this feeds the disability-pension (EMR) assessment specifically, not the GdB.",
        "Objective tests already done, if any: 6-minute walk test, grip-strength measurement, neuropsychological testing — and the result.",
        "Occupational context (for the MdE assessment only): has your condition been recognized, reported, or is it suspected as work-related by the German statutory accident insurance (Berufsgenossenschaft) — e.g. infection during healthcare, lab, or care work (BK-Nr. 3101)?",
      ],
    },
    usageModel:
      `Not a subscription or an open time window: every request is still one payment = one question = one answer, there is no ongoing session or conversation. New wallet: ${toDisplay(getNewWalletPriceAmount())} USAT. The SAME wallet asking again within 55 minutes of its last paid request: ${toDisplay(getReturningWalletPriceAmount())} USAT (each paid request resets the 55-minute window again) - see price.howToGetTheReturningPrice below for how to use it.`,
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
