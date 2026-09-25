import { NextRequest, NextResponse } from "next/server";
import { incrementCompleted, incrementStarted } from "@/lib/userCount";

// Einziger Netzwerk-Call in der gesamten Tier-1-Triage (siehe
// app/TriageFlow.tsx, app/page.tsx) - Tier 1 selbst bleibt bewusst rein
// clientseitig und kostenlos, das hier ist nur ein anonymer Zähler
// (Redis-INCR über lib/userCount.ts), kein Anthropic-Call, keine
// Speicherung von Antworten/Inhalten. Siehe
// build/phase9-bastet-2.0-self-gatekeeper.md, Abschnitt Tier-1-Qualität.
export const runtime = "nodejs";

interface TrackTier1Body {
  event?: "started" | "completed";
}

export async function POST(request: NextRequest) {
  const body: TrackTier1Body = await request.json().catch(() => ({}));

  if (body.event === "started") {
    void incrementStarted("tier1");
  } else if (body.event === "completed") {
    void incrementCompleted("tier1");
  }

  // Immer 204, egal ob der Zähler geklappt hat - eine fehlgeschlagene
  // Zählung darf dem Frontend nie als Fehler auffallen (fire-and-forget,
  // gleiches Prinzip wie incrementStarted/incrementCompleted selbst).
  return new NextResponse(null, { status: 204 });
}
