// GET /api/pricing — liefert den aktuellen Preis der Detailanalyse an den
// Client. Bewusst zur Laufzeit vom Server gelesen statt als NEXT_PUBLIC_-Env
// clientseitig gebündelt: so liest der Client immer den echten, aktuellen
// Wert aus lib/pricing.ts (bzw. der DETAILED_ANALYSIS_PRICE_CENTS-Env-Var),
// ohne Rebuild-Abhängigkeit oder Risiko eines veralteten, im JS-Bundle
// eingebrannten Preises.
import { NextResponse } from "next/server";
import { DETAILED_ANALYSIS_PRICE_CENTS, DETAILED_ANALYSIS_CURRENCY, formatDetailedAnalysisPrice } from "@/lib/pricing";

export async function GET() {
  return NextResponse.json({
    cents: DETAILED_ANALYSIS_PRICE_CENTS,
    currency: DETAILED_ANALYSIS_CURRENCY,
    formatted: formatDetailedAnalysisPrice(),
  });
}
