// GET /api/pricing — liefert Preis UND Kill-Switch-Status der Detailanalyse
// an den Client. Bewusst zur Laufzeit vom Server gelesen statt als
// NEXT_PUBLIC_-Env clientseitig gebündelt: so liest der Client immer den
// echten, aktuellen Stand aus lib/pricing.ts/lib/paywall.ts, ohne Rebuild-
// Abhängigkeit oder Risiko eines im JS-Bundle eingebrannten alten Werts.
// paywallEnabled steuert hier nur Anzeige-Text (app/page.tsx); die
// eigentliche, sicherheitsrelevante Weiche liegt serverseitig in
// app/api/assessment/route.ts.
import { NextResponse } from "next/server";
import { DETAILED_ANALYSIS_PRICE_CENTS, DETAILED_ANALYSIS_CURRENCY, formatDetailedAnalysisPrice } from "@/lib/pricing";
import { isPaywallEnabled } from "@/lib/paywall";

export async function GET() {
  return NextResponse.json({
    cents: DETAILED_ANALYSIS_PRICE_CENTS,
    currency: DETAILED_ANALYSIS_CURRENCY,
    formatted: formatDetailedAnalysisPrice(),
    paywallEnabled: isPaywallEnabled(),
  });
}
