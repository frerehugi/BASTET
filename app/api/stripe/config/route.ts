// GET /api/stripe/config — liefert den Stripe Publishable Key an den Client.
// Publishable Keys sind per Design nicht geheim (deshalb "publishable") -
// trotzdem bewusst per Server-Endpoint statt NEXT_PUBLIC_-Env ausgeliefert,
// damit exakt der in der Aufgabenstellung genannte Variablenname
// STRIPE_PUBLISHABLE_KEY (ohne NEXT_PUBLIC_-Präfix) funktioniert - ein
// clientseitig gebündeltes process.env.STRIPE_PUBLISHABLE_KEY wäre in
// Next.js sonst immer undefined (nur NEXT_PUBLIC_*-Variablen landen im
// Browser-Bundle).
import { NextResponse } from "next/server";

export async function GET() {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) {
    return NextResponse.json(
      { error: "STRIPE_PUBLISHABLE_KEY ist auf dem Server nicht gesetzt (Vercel Environment Variables)." },
      { status: 500 }
    );
  }
  return NextResponse.json({ publishableKey });
}
