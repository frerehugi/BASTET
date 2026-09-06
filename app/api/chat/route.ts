import { NextResponse } from "next/server";
import { runInterview } from "@/lib/chat";
import type { ChatMessage } from "@/lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 150;

interface ChatRequestBody {
  messages: ChatMessage[];
  diagnosisConfirmed: boolean;
  turnCount: number;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages fehlt oder ist ungültig." }, { status: 400 });
  }

  try {
    const text = await runInterview(
      body.messages,
      !!body.diagnosisConfirmed,
      typeof body.turnCount === "number" ? body.turnCount : 0
    );
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
