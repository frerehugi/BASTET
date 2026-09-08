// POST /api/assessment — der EINE Web-Chat-Endpoint für den Betroffenen-Arm,
// unabhängig vom Zahlungs-Kill-Switch (siehe lib/paywall.ts). Einziger
// Verzweigungspunkt im gesamten Request-Fluss:
//   - PAYWALL_ENABLED=true  -> kostenlose Schnell-Einschätzung (Stufe 1,
//     lib/chat.ts runQuickAssessment), Detailanalyse dann nur über
//     app/api/detailed-assessment nach bezahlter Freischaltung.
//   - PAYWALL_ENABLED unset/false (Default) -> direkt die volle
//     Detailanalyse (lib/chat.ts runInterview), exakt wie der Telegram-Arm
//     sie schon immer bekommt — kein Zahlungs-, kein Webhook-, kein
//     Entitlement-Schritt im Pfad.
// Die Stripe-/Freischalt-Routen (checkout, stripe/webhook, detailed-
// assessment) bleiben unverändert im Repo, werden bei deaktiviertem Kill-
// Switch aber schlicht nie aufgerufen: app/DetailedAnalysisUpsell.tsx
// rendert sich nur, wenn eine Antwort von hier den Schnell-Einschätzung-
// Marker trägt (lib/format.ts isQuickVerdict) — bei voller Detailanalyse ist
// das nie der Fall.
import { NextResponse } from "next/server";
import { runQuickAssessment, runInterview } from "@/lib/chat";
import { isPaywallEnabled } from "@/lib/paywall";
import type { ChatMessage } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 150;

interface AssessmentRequestBody {
  messages: ChatMessage[];
  diagnosisConfirmed: boolean;
  turnCount: number;
}

export async function POST(request: Request) {
  let body: AssessmentRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages fehlt oder ist ungültig." }, { status: 400 });
  }

  const diagnosisConfirmed = !!body.diagnosisConfirmed;
  const turnCount = typeof body.turnCount === "number" ? body.turnCount : 0;

  try {
    const text = isPaywallEnabled()
      ? await runQuickAssessment(body.messages, diagnosisConfirmed, turnCount)
      : await runInterview(body.messages, diagnosisConfirmed, turnCount);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
