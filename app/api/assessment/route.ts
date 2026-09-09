// POST /api/assessment — Stufe 1, die kostenlose Schnell-Einschätzung.
// Unconditionally frei, unabhängig von PAYWALL_ENABLED (siehe lib/paywall.ts)
// — der Kill-Switch betrifft ausschließlich Stufe 2 (app/api/detailed-
// assessment/route.ts). Nimmt den bereits ausgefüllten Stufe-1-Fragebogen
// entgegen (lib/interviewAnswers.ts Stage1Answers), serialisiert ihn
// (lib/serializeAnswers.ts) und ruft lib/chat.ts runQuickAssessment einmalig
// auf — kein Gesprächsverlauf, keine serverseitige Speicherung.
import { NextResponse } from "next/server";
import { runQuickAssessment } from "@/lib/chat";
import { serializeStage1 } from "@/lib/serializeAnswers";
import type { Stage1Answers } from "@/lib/interviewAnswers";

export const runtime = "nodejs";
export const maxDuration = 30;

interface AssessmentRequestBody {
  stage1: Stage1Answers;
  diagnosisConfirmed: boolean;
}

export async function POST(request: Request) {
  let body: AssessmentRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (!body.stage1 || typeof body.stage1 !== "object") {
    return NextResponse.json({ error: "stage1 fehlt oder ist ungültig." }, { status: 400 });
  }

  try {
    const serialized = serializeStage1(body.stage1);
    const text = await runQuickAssessment(serialized, !!body.diagnosisConfirmed);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
