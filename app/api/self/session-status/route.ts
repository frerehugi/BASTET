import { NextRequest, NextResponse } from "next/server";
import { getSelfSessionStatus } from "@/lib/selfSessions";

export const runtime = "nodejs";

/**
 * Wird vom Frontend nach der Rückleitung von Self gepollt (app/page.tsx),
 * um zu erfahren, ob der Webhook (app/api/self/webhook) das Ergebnis schon
 * eingetragen hat - der Redirect selbst kommt oft etwas früher an als der
 * Server-zu-Server-Webhook.
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ status: "invalid", reason: "missing id" }, { status: 400 });
  }
  try {
    const status = await getSelfSessionStatus(id);
    return NextResponse.json(status);
  } catch (error) {
    // Fail-safe wie überall sonst in der Self-Integration: ein Redis-Hänger
    // hier darf dem Frontend nie als harter Fehler erscheinen, sondern nur
    // wie "Ergebnis noch nicht da" - der Poll-Loop in app/page.tsx versucht
    // es einfach erneut und läuft nach ein paar Sekunden in die eigene
    // Timeout-Meldung, statt an einem 500 mit HTML-Fehlerseite zu scheitern.
    console.error("Self-Session-Status konnte nicht gelesen werden:", error);
    return NextResponse.json({ status: "pending" } satisfies { status: "pending" });
  }
}
