// POST /api/checkout — wird aufgerufen, wenn Nutzer:innen die (bei aktivem
// Kill-Switch) kostenpflichtige Detailanalyse abschicken, BEVOR die
// eigentliche Zahlung läuft. Speichert den ausgefüllten Fragebogen
// serverseitig (siehe lib/assessmentSession.ts, warum das nötig ist) und
// legt beim Stripe-PaymentIntent die sessionId als Metadata ab, damit der
// Webhook (app/api/stripe/webhook/route.ts) nach erfolgreicher Zahlung
// weiß, welche Session freizuschalten ist. Nur erreicht, wenn
// PAYWALL_ENABLED=true — siehe app/api/detailed-assessment/route.ts.
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getStripeClient } from "@/lib/stripe";
import { DETAILED_ANALYSIS_PRICE_CENTS, DETAILED_ANALYSIS_CURRENCY } from "@/lib/pricing";
import { createAssessmentSession } from "@/lib/assessmentSession";
import type { Stage1Answers, Stage2Answers } from "@/lib/interviewAnswers";

export const runtime = "nodejs";
export const maxDuration = 30;

interface CheckoutRequestBody {
  stage1: Stage1Answers;
  stage2: Stage2Answers;
  diagnosisConfirmed: boolean;
}

export async function POST(request: Request) {
  let body: CheckoutRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (!body.stage1 || !body.stage2) {
    return NextResponse.json({ error: "stage1/stage2 fehlt oder ist ungültig." }, { status: 400 });
  }

  const sessionId = randomUUID();

  try {
    await createAssessmentSession(sessionId, {
      stage1: body.stage1,
      stage2: body.stage2,
      diagnosisConfirmed: !!body.diagnosisConfirmed,
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
