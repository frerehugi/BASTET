// Preis der kostenpflichtigen Detailanalyse — einziger Ort, der geändert
// werden muss (Stripe-Betrag, UI-Anzeige über GET /api/pricing, Webhook/
// Freischalt-Logik lesen alle von hier bzw. vom selben Env-Var).
//
// PLATZHALTER: 5,00 € ist noch nicht kalkuliert. Vor Live-Gang durch den
// tatsächlichen Wert ersetzen — entweder DETAILED_ANALYSIS_PRICE_CENTS als
// Vercel-Environment-Variable setzen (hat Vorrang) oder den Platzhalter
// unten direkt anpassen. Grundlage für die echte Kalkulation: tatsächliche
// Anthropic-API-Kosten pro Detailanalyse (Sonnet-Aufruf mit vollständiger
// Wissensbasis im Kontext, siehe lib/chat.ts runInterview/buildSystemPrompt).
// Stripe akzeptiert ab 0,50 € (bzw. Fremdwährungsäquivalent) — bei einer
// späteren Änderung beachten.
const PLACEHOLDER_PRICE_CENTS = 500;

function resolvePriceCents(): number {
  const fromEnv = process.env.DETAILED_ANALYSIS_PRICE_CENTS;
  if (!fromEnv) return PLACEHOLDER_PRICE_CENTS;
  const parsed = Number(fromEnv);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : PLACEHOLDER_PRICE_CENTS;
}

export const DETAILED_ANALYSIS_PRICE_CENTS = resolvePriceCents();
export const DETAILED_ANALYSIS_CURRENCY = "eur";

export function formatDetailedAnalysisPrice(): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: DETAILED_ANALYSIS_CURRENCY.toUpperCase(),
  }).format(DETAILED_ANALYSIS_PRICE_CENTS / 100);
}
