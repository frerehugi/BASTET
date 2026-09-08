// POST /api/stripe/webhook — einzige Quelle der Wahrheit für "wurde bezahlt".
// app/api/detailed-assessment/route.ts vertraut NUR dem hier gesetzten
// Redis-Status, nie einem clientseitigen "Zahlung erfolgreich" allein — ein
// manipulierter Client könnte sonst die Detailanalyse ohne echte Zahlung
// freischalten. Signaturprüfung (stripe.webhooks.constructEvent) verhindert
// gefälschte Webhook-Aufrufe.
import { NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { markAssessmentSessionPaid } from "@/lib/assessmentSession";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET ist auf dem Server nicht gesetzt.");
    return NextResponse.json({ error: "Webhook nicht konfiguriert." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Fehlende stripe-signature." }, { status: 400 });
  }

  // Signaturprüfung braucht den unveränderten Rohtext, nicht das geparste JSON.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripeClient().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signaturprüfung fehlgeschlagen.";
    console.error("Stripe-Webhook: ungültige Signatur:", message);
    return NextResponse.json({ error: "Ungültige Signatur." }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const sessionId = paymentIntent.metadata?.sessionId;
    if (sessionId) {
      await markAssessmentSessionPaid(sessionId);
    } else {
      console.warn("Stripe-Webhook: payment_intent.succeeded ohne sessionId-Metadata:", paymentIntent.id);
    }
  }

  return NextResponse.json({ received: true });
}
