import { NextRequest, NextResponse } from "next/server";
import { runExpatConsult } from "@/lib/expatConsult";
import {
  buildPaymentRequirements,
  buildPaymentRequiredBody,
  parsePaymentHeader,
  verifyPayment,
  settlePayment,
} from "@/lib/x402";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ConsultRequestBody {
  question: string;
}

const DESCRIPTION =
  "BASTET expat consult: English-language orientation on Post-COVID/ME-CFS in German social law (GdB/MdE/EMR), grounded in a curated German legal/medical knowledge base.";

export async function POST(request: NextRequest) {
  let body: ConsultRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (typeof body.question !== "string" || !body.question.trim()) {
    return NextResponse.json({ error: "`question` is required." }, { status: 400 });
  }
  if (body.question.length > 4000) {
    return NextResponse.json({ error: "`question` is too long (max 4000 characters)." }, { status: 400 });
  }

  const resourceUrl = request.nextUrl.href;
  let requirement;
  try {
    requirement = buildPaymentRequirements(resourceUrl, DESCRIPTION);
  } catch (error) {
    // Fehlende Server-Konfiguration (z.B. X402_ASSET_ADDRESS) - klarer
    // Fehler statt eines rohen 500-Crashs, damit das beim Deploy sofort
    // auffällt statt erst beim ersten echten Zahlungsversuch.
    const message = error instanceof Error ? error.message : "Server configuration error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const paymentHeader = request.headers.get("X-PAYMENT");
  let paymentPayload: unknown;
  try {
    paymentPayload = parsePaymentHeader(paymentHeader);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment required.";
    return NextResponse.json(buildPaymentRequiredBody(requirement, message), { status: 402 });
  }

  // Verify: reine Signatur-/Gültigkeitsprüfung, löst noch KEINE
  // On-Chain-Transaktion aus - erst nach erfolgreicher Service-Erbringung
  // unten wird tatsächlich settled (siehe lib/x402.ts-Kommentar: keine
  // Abbuchung, wenn die eigene Verarbeitung danach fehlschlägt).
  try {
    const verification = await verifyPayment(paymentPayload, requirement);
    if (!verification.isValid) {
      return NextResponse.json(
        buildPaymentRequiredBody(requirement, verification.invalidReason || "Payment verification failed."),
        { status: 402 }
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facilitator unreachable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  let answer: string;
  try {
    answer = await runExpatConsult(body.question);
  } catch (error) {
    // Zahlung verifiziert, aber eigene Verarbeitung fehlgeschlagen (z.B.
    // Anthropic-API-Fehler) - bewusst NICHT settlen, damit niemand für eine
    // nicht gelieferte Antwort zahlt.
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  try {
    const settlement = await settlePayment(paymentPayload, requirement);
    if (!settlement.success) {
      return NextResponse.json({ error: settlement.error || "Settlement failed." }, { status: 402 });
    }
    return NextResponse.json(
      { answer },
      {
        headers: settlement.txHash ? { "X-PAYMENT-RESPONSE": settlement.txHash } : undefined,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Facilitator unreachable.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
