/**
 * x402-Facilitator-Client für den Celo-gehosteten Facilitator
 * (https://x402.celo.org) — schützt app/api/x402/consult/route.ts.
 *
 * WICHTIGER VORBEHALT, VOR PRODUKTIVEM MAINNET-EINSATZ ZU PRÜFEN: Dieses
 * Modul implementiert direkt gegen die öffentlich dokumentierte x402-
 * Protokollebene (HTTP-402-Response mit `accepts`-Array, `X-PAYMENT`-Header,
 * Facilitator-Endpunkte `/verify` und `/settle` — die geteilte REST-Schicht,
 * die x402 über Ketten/Implementierungen hinweg einheitlich macht), NICHT
 * gegen ein bestätigtes Celo-eigenes SDK-Paket. Bei der Recherche in dieser
 * Session gab es widersprüchliche Angaben zum tatsächlichen npm-Paket
 * (teils `@x402/*`, teils `thirdweb/x402`) und `x402.celo.org`/`docs.celo.org`
 * selbst waren über das Sandbox-Netzwerk nicht erreichbar (EGRESS_BLOCKED).
 * Vor dem ersten echten Mainnet-Aufruf: `https://x402.celo.org/SKILL.md`
 * live abrufen und mindestens die Facilitator-Pfade (`/verify`, `/settle`)
 * sowie das genaue `accepts`-Objektschema gegenprüfen. Deshalb standardmäßig
 * auf Celo Sepolia (Testnet) konfiguriert — `X402_NETWORK=celo` erst nach
 * dieser Prüfung setzen.
 */

const DEFAULT_NETWORK = "celo-sepolia";

function getNetwork(): string {
  return process.env.X402_NETWORK || DEFAULT_NETWORK;
}

function getFacilitatorBaseUrl(): string {
  // Zwei vom Celo-Dashboard getrennte Facilitator-Hosts (Mainnet/Testnet) -
  // siehe x402.celo.org-Dashboard-Dokumentation (api.x402.celo.org vs.
  // api.x402.sepolia.celo.org). Override via Env-Var für den Fall, dass sich
  // die Hosts ändern, bevor der Code hier aktualisiert wird.
  if (process.env.X402_FACILITATOR_URL) return process.env.X402_FACILITATOR_URL;
  return getNetwork() === "celo" ? "https://api.x402.celo.org" : "https://api.x402.sepolia.celo.org";
}

function getApiKey(): string {
  const key = process.env.X402_API_KEY;
  if (!key) {
    throw new Error("X402_API_KEY ist nicht gesetzt (Vercel Environment Variables, x402.celo.org-Dashboard).");
  }
  return key;
}

/** USAT: 6 Dezimalstellen (bestätigt über Blockexplorer-Daten, siehe build/phase10-english-expat-bastet.md-Recherche). */
const USAT_DECIMALS = 6;

export interface PaymentRequirement {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
  extra?: Record<string, unknown>;
}

/**
 * Preis in USAT-Basiseinheiten (0,1 USAT = 100000 bei 6 Dezimalstellen) -
 * kalkuliert gegen die tatsächlichen Sonnet-5-Kosten des Consult-Aufrufs
 * (~0,014 $ bei vollem Wissensbasis-Kontext + Prompt-Caching), ca. 86 % Marge.
 * Override via Env-Var für einfaches Preis-Tuning ohne Code-Änderung.
 */
export function getPriceBaseUnits(): string {
  if (process.env.X402_PRICE_BASE_UNITS) return process.env.X402_PRICE_BASE_UNITS;
  const usat = 0.1;
  return String(Math.round(usat * 10 ** USAT_DECIMALS));
}

function getAssetAddress(): string {
  // BEWUSST kein hartkodierter Default: eine recherchierte USAT-Celo-Adresse
  // aus dieser Session war nicht gegen die x402-Facilitator-eigene
  // unterstützte-Token-Liste verifizierbar (x402.celo.org war blockiert).
  // Lieber ein klarer Fehler beim Fehlen der Env-Var als eine stillschweigend
  // falsche Adresse, an die echtes Geld gehen könnte.
  const asset = process.env.X402_ASSET_ADDRESS;
  if (!asset) {
    throw new Error(
      "X402_ASSET_ADDRESS ist nicht gesetzt - USAT-Contract-Adresse auf Celo vor dem " +
        "ersten Aufruf gegen https://x402.celo.org/SKILL.md verifizieren, dann als " +
        "Vercel Environment Variable hinterlegen."
    );
  }
  return asset;
}

function getPayToAddress(): string {
  // Default: die bereits unter ERC-8004 (Agent-IDs 9817/9818) registrierte
  // BASTET-Wallet (siehe lib/content.ts, BASTET_WALLET_ADDRESS) - dieselbe
  // Identität, kein zweites Wallet nötig.
  return process.env.X402_PAYTO_ADDRESS || "0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608";
}

export function buildPaymentRequirements(resourceUrl: string, description: string): PaymentRequirement {
  return {
    scheme: "exact",
    network: getNetwork(),
    maxAmountRequired: getPriceBaseUnits(),
    resource: resourceUrl,
    description,
    mimeType: "application/json",
    payTo: getPayToAddress(),
    maxTimeoutSeconds: 60,
    asset: getAssetAddress(),
  };
}

/** Antwortform bei fehlendem/ungültigem X-PAYMENT-Header, per x402-Spezifikation. */
export function buildPaymentRequiredBody(requirement: PaymentRequirement, error: string) {
  return {
    x402Version: 1,
    error,
    accepts: [requirement],
  };
}

interface FacilitatorVerifyResult {
  isValid: boolean;
  invalidReason?: string;
}

interface FacilitatorSettleResult {
  success: boolean;
  error?: string;
  txHash?: string;
  networkId?: string;
}

async function callFacilitator<T>(path: string, paymentPayload: unknown, requirement: PaymentRequirement): Promise<T> {
  const response = await fetch(`${getFacilitatorBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      x402Version: 1,
      paymentPayload,
      paymentRequirements: requirement,
    }),
  });
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      detail = data?.error || data?.message || detail;
    } catch {
      // Antwort war kein JSON - bei der HTTP-Statuscode-Meldung bleiben.
    }
    throw new Error(`Facilitator-Fehler (${path}): ${detail}`);
  }
  return (await response.json()) as T;
}

/**
 * Parst den `X-PAYMENT`-Header (base64-kodiertes JSON-Payment-Payload, siehe
 * x402-Spezifikation) - wirft bei ungültigem/fehlendem Header, der Aufrufer
 * (app/api/x402/consult/route.ts) fängt das ab und antwortet mit 402.
 */
export function parsePaymentHeader(header: string | null): unknown {
  if (!header) throw new Error("X-PAYMENT-Header fehlt.");
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
  } catch {
    throw new Error("X-PAYMENT-Header ist kein gültiges base64-kodiertes JSON.");
  }
}

export async function verifyPayment(
  paymentPayload: unknown,
  requirement: PaymentRequirement
): Promise<FacilitatorVerifyResult> {
  return callFacilitator<FacilitatorVerifyResult>("/verify", paymentPayload, requirement);
}

export async function settlePayment(
  paymentPayload: unknown,
  requirement: PaymentRequirement
): Promise<FacilitatorSettleResult> {
  return callFacilitator<FacilitatorSettleResult>("/settle", paymentPayload, requirement);
}
