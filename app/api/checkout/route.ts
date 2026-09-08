// POST /api/checkout — wird aufgerufen, wenn Nutzer:innen die kostenpflichtige
// Detailanalyse freischalten wollen, BEVOR die eigentliche Zahlung läuft.
// Speichert den bisherigen Gesprächsverlauf serverseitig (siehe
// lib/assessmentSession.ts, warum das nötig ist) und legt beim Stripe-
// PaymentIntent die sessionId als Metadata ab, damit der Webhook
// (app/api/stripe/webhook/route.ts) nach erfolgreicher Zahlung weiß, welche
// Session freizuschalten ist.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getStripeClient } from "@/lib/stripe";
import { DETAILED_ANALYSIS_PRICE_CENTS, DETAILED_ANALYSIS_CURRENCY } from "@/lib/pricing";
import { createAssessmentSession } from "@/lib/assessmentSession";
import type { ChatMessage } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

interface CheckoutRequestBody {
  messages: ChatMessage[];
  diagnosisConfirmed: boolean;
  turnCount: number;
}

export async function POST(request: Request) {
  let body: CheckoutRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages fehlt oder ist leer." }, { status: 400 });
  }

  const sessionId = randomUUID();

  try {
    await createAssessmentSession(sessionId, {
      messages: body.messages,
      diagnosisConfirmed: !!body.diagnosisConfirmed,
      turnCount: typeof body.turnCount === "number" ? body.turnCount : 0,
    });

    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: DETAILED_ANALYSIS_PRICE_CENTS,
      currency: DETAILED_ANALYSIS_CURRENCY,
      automatic_payment_methods: { enabled: true },
      metadata: { sessionId, product: "bastet-detailed-assessment" },
    });

    return NextResponse.json({ sessionId, clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
