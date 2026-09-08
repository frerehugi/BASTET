// Stripe-Server-Client für die Detailanalyse-Bezahlung (Express Checkout
// Element, Apple Pay/Google Pay). Komplett getrennt von lib/x402.ts — das ist
// die Krypto-/x402-Zahlungsschiene für den separaten Hackathon-Premium-
// Endpoint (app/api/premium/route.ts), hat mit dieser Funktion nichts zu tun.
import Stripe from "stripe";

let cachedStripe: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (cachedStripe) return cachedStripe;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY ist auf dem Server nicht gesetzt (Vercel Environment Variables).");
  }
  cachedStripe = new Stripe(secretKey);
  return cachedStripe;
}
