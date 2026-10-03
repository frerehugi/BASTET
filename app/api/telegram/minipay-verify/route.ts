import { verifyMiniPayPaymentAndGrantAccess } from "@/lib/minipayTelegramToken";

export const runtime = "nodejs";
export const maxDuration = 30; // on-chain Lookup + kurzer Retry, kein Anthropic-Call hier

// Cross-Origin: diese Route wird von bastet.osirisapp.xyz aus aufgerufen
// (eigenes Vercel-Projekt/eigene Domain, siehe OSIRIS-Repo apis/bastet-pay)
// - bewusst auf genau diesen einen Origin beschränkt statt "*".
const ALLOWED_ORIGIN = "https://bastet.osirisapp.xyz";

function corsHeaders(): HeadersInit {
  return {
    "access-control-allow-origin": ALLOWED_ORIGIN,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

interface Body {
  chatId?: number;
  txHash?: string;
}

export async function POST(request: Request): Promise<Response> {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ungültiger Request-Body." }, { status: 400, headers: corsHeaders() });
  }

  const { chatId, txHash } = body;
  if (typeof chatId !== "number" || typeof txHash !== "string") {
    return Response.json({ error: "chatId (number) und txHash (string) sind erforderlich." }, { status: 400, headers: corsHeaders() });
  }

  try {
    const { expiresAt } = await verifyMiniPayPaymentAndGrantAccess(chatId, txHash);
    return Response.json({ ok: true, expiresAt }, { headers: corsHeaders() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verifikation fehlgeschlagen.";
    console.error("MiniPay-Verifikation fehlgeschlagen:", error);
    return Response.json({ error: message }, { status: 400, headers: corsHeaders() });
  }
}
