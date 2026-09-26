import { SelfClient, SelfWebhooks, type WebhookEvent } from "@selfxyz/enterprise-sdk";

// Dünner Wrapper um @selfxyz/enterprise-sdk (nicht das ältere, laut eigener
// .d.ts als "legacy"/"deprecated" markierte @selfxyz/qrcode+@selfxyz/core-
// Paar - dort verweist die Dokumentation im Paket selbst ausdrücklich auf
// diesen Nachfolger). Wichtiger Unterschied zum ursprünglich recherchierten
// QR-Code-Ansatz: Self selbst hostet die komplette Verifizierungs-UI
// (verificationUrl) - BASTET rendert keinen eigenen QR-Code und rührt keine
// ZK-Proof-Kryptografie an, sondern leitet nur dorthin weiter und nimmt am
// Ende einen signierten Webhook entgegen (siehe verifySelfWebhook unten).
//
// Drei nötige Secrets, alle nur in den Vercel-Umgebungsvariablen gesetzt,
// nie im Code:
// - SELF_API_KEY: Bearer-Key aus dem Self-Dashboard (sk_live_... / sk_test_...)
// - SELF_FLOW_ID: ID des im Self-Dashboard angelegten "proof_of_human"-Flows
// - SELF_WEBHOOK_SECRET: Signierschlüssel für eingehende Webhooks (whsec_...)
// Alle drei müssen von Florian im Self-Dashboard erzeugt werden - das kann
// diese Session nicht automatisiert nachholen (kein Zugriff auf einen
// Browser/Account bei Self). Siehe lib/selfFeatureFlag.ts: fehlen sie, bleibt
// die Verifizierung unabhängig vom An/Aus-Schalter technisch immer aus.

let cachedClient: SelfClient | null = null;

function getSelfClient(): SelfClient {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.SELF_API_KEY;
  if (!apiKey) {
    throw new Error("SELF_API_KEY ist nicht gesetzt (Vercel Environment Variables).");
  }
  cachedClient = new SelfClient({ apiKey });
  return cachedClient;
}

export interface CreateSelfSessionParams {
  /** Eigene Korrelations-ID (crypto.randomUUID()) - verknüpft Session, Webhook und Rücksprung. */
  externalUuid: string;
  successUrl: string;
  failureUrl: string;
}

export interface CreateSelfSessionResult {
  id: string;
  verificationUrl: string;
}

/**
 * Legt eine neue Verifizierungs-Session bei Self an. Der Rückgabewert
 * `verificationUrl` ist eine von Self gehostete Seite (QR-Code für Desktop,
 * direkter App-Deeplink für Mobile - Self entscheidet das selbst), dorthin
 * wird die Person weitergeleitet. 15 Minuten Gültigkeit: reicht für einen
 * bewussten Verifizierungsversuch, ohne verwaiste Sessions unnötig lang
 * offen zu halten.
 */
export async function createSelfVerificationSession(
  params: CreateSelfSessionParams
): Promise<CreateSelfSessionResult> {
  const flowId = process.env.SELF_FLOW_ID;
  if (!flowId) {
    throw new Error("SELF_FLOW_ID ist nicht gesetzt (Vercel Environment Variables).");
  }
  const session = await getSelfClient().sessions.create({
    flowId,
    externalUuid: params.externalUuid,
    successUrl: params.successUrl,
    failureUrl: params.failureUrl,
    expiresInSeconds: 15 * 60,
  });
  return { id: session.id, verificationUrl: session.verificationUrl };
}

/**
 * Prüft die Svix-Signatur eines eingehenden Self-Webhooks und liefert das
 * typisierte Event zurück. Wirft bei ungültiger Signatur/Payload - der
 * Aufrufer (app/api/self/webhook) muss das als 4xx beantworten, NICHT
 * stillschweigend verschlucken, sonst ließen sich Webhooks fälschen.
 */
export function verifySelfWebhook(rawBody: string, headers: Record<string, string>): WebhookEvent {
  const secret = process.env.SELF_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("SELF_WEBHOOK_SECRET ist nicht gesetzt (Vercel Environment Variables).");
  }
  return SelfWebhooks.verify(rawBody, headers, secret);
}
