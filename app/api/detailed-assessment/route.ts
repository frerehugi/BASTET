// POST /api/detailed-assessment — liefert die kostenpflichtige Detailanalyse
// (volles Modell, volle Wissensbasis, GdB-/MdE-Werte mit Quellenbelegen).
// NUR erreichbar, wenn der Stripe-Webhook die Session bereits als "paid"
// markiert hat (siehe lib/assessmentSession.ts) — nimmt bewusst nur eine
// sessionId entgegen, nie den Gesprächsverlauf vom Client, damit die Analyse
// ausschließlich auf dem serverseitig gespeicherten, mit der Zahlung
// verknüpften Transkript basiert.
import { NextResponse } from "next/server";
import { runInterview, FORCE_EVALUATION_DIRECTIVE } from "@/lib/chat";
import { getAssessmentSession, deleteAssessmentSession } from "@/lib/assessmentSession";

export const runtime = "nodejs";
export const maxDuration = 150;

interface DetailedAssessmentRequestBody {
  sessionId: string;
}

export async function POST(request: Request) {
  let body: DetailedAssessmentRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (typeof body.sessionId !== "string" || !body.sessionId) {
    return NextResponse.json({ error: "sessionId fehlt." }, { status: 400 });
  }

  const session = await getAssessmentSession(body.sessionId);
  if (!session) {
    return NextResponse.json(
      { error: "Session nicht gefunden oder abgelaufen. Bitte Detailanalyse erneut freischalten." },
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
    const messagesWithDirective = [
      ...session.messages,
      { role: "user" as const, content: FORCE_EVALUATION_DIRECTIVE },
    ];
    const text = await runInterview(messagesWithDirective, session.diagnosisConfirmed, session.turnCount);
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
