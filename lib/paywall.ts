// Kill-Switch für die Stripe-Bezahlschranke der Detailanalyse (siehe README,
// Abschnitt "Zweistufige Auswertung"). Default AUS: bis Preis/Stripe-Setup
// final sind, bleibt die volle Detailanalyse auf allen Kanälen direkt und
// kostenlos zugänglich, exakt wie beim Telegram-Arm. Einzige Stelle, die auf
// diese Variable prüft, ist app/api/assessment/route.ts (POST) — bewusst kein
// zweiter Zweig irgendwo sonst im Code.
export function isPaywallEnabled(): boolean {
  return process.env.PAYWALL_ENABLED === "true";
}
