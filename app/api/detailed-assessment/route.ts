// POST /api/detailed-assessment — Stufe 2, die Detailanalyse (volles
// Modell, volle Wissensbasis, drei getrennte Ergebnisspuren mit
// Quellenbelegen). EINZIGER Verzweigungspunkt für den Zahlungs-Kill-Switch
// auf dieser Stufe (siehe lib/paywall.ts):
//   - PAYWALL_ENABLED=true: nimmt NUR eine sessionId entgegen, nie den
//     Fragebogen direkt vom Client — liefert ausschließlich, wenn der
//     Stripe-Webhook die Session bereits als "paid" markiert hat (siehe
//     lib/assessmentSession.ts). So basiert die Analyse ausschließlich auf
//     dem serverseitig gespeicherten, mit der Zahlung verknüpften Fragebogen.
//   - PAYWALL_ENABLED unset/false (Default): nimmt stage1/stage2 direkt
//     entgegen und erzeugt die Analyse sofort, ohne Redis/Stripe im Pfad.
import { NextResponse } from "next/server";
import { runDetailedAssessmentFromAnswers } from "@/lib/chat";
import { serializeStage1, serializeStage2 } from "@/lib/serializeAnswers";
import { getAssessmentSession, deleteAssessmentSession } from "@/lib/assessmentSession";
import { isPaywallEnabled } from "@/lib/paywall";
import type { Stage1Answers, Stage2Answers } from "@/lib/interviewAnswers";

export const runtime = "nodejs";
export const maxDuration = 150;

interface DetailedAssessmentRequestBody {
  sessionId?: string;
  stage1?: Stage1Answers;
  stage2?: Stage2Answers;
  diagnosisConfirmed?: boolean;
}

export async function POST(request: Request) {
  let body: DetailedAssessmentRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (isPaywallEnabled()) {
    if (typeof body.sessionId !== "string" || !body.sessionId) {
      return NextResponse.json({ error: "sessionId fehlt." }, { status: 400 });
    }

    const session = await getAssessmentSession(body.sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session nicht gefunden oder abgelaufen. Bitte Detailanalyse erneut abschicken." },
        { status: 404 }
      );
    }

    if (session.status !== "paid") {
      // Kein Fehler im eigentlichen Sinne - der Webhook braucht ggf. noch
      // einen Moment. Client pollt/versucht in diesem Fall erneut.
      return NextResponse.json(
        { error: "Zahlung noch nicht bestätigt. Bitte in Kürze erneut versuchen.", pending: true },
        { status: 402 }
      );
    }

    try {
      const serialized = `${serializeStage1(session.stage1)}\n\n${serializeStage2(session.stage1, session.stage2)}`;
      const text = await runDetailedAssessmentFromAnswers(serialized, session.diagnosisConfirmed);
      // Datenminimierung: nach erfolgreicher Auslieferung nicht länger vorhalten.
      // Bei einem Fehler unten bleibt die Session erhalten (TTL greift), damit
      // ein Retry nicht erneut bezahlt werden muss.
      await deleteAssessmentSession(body.sessionId);
      return NextResponse.json({ text });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Kill-Switch aus: direkt, ohne Redis/Stripe.
  if (!body.stage1 || !body.stage2) {
    return NextResponse.json({ error: "stage1/stage2 fehlt oder ist ungültig." }, { status: 400 });
  }

  try {
    const serialized = `${serializeStage1(body.stage1)}\n\n${serializeStage2(body.stage1, body.stage2)}`;
    const text = await runDetailedAssessmentFromAnswers(serialized, !!body.diagnosisConfirmed);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
