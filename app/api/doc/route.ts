import { NextResponse } from "next/server";
import { runDocAssessment } from "@/lib/doc";

export const runtime = "nodejs";
export const maxDuration = 150;

interface DocRequestBody {
  userInput: string;
}

export async function POST(request: Request) {
  let body: DocRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (typeof body.userInput !== "string" || !body.userInput.trim()) {
    return NextResponse.json({ error: "userInput fehlt." }, { status: 400 });
  }

  try {
    const text = await runDocAssessment(body.userInput);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
