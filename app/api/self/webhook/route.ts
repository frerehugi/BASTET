import { NextRequest, NextResponse } from "next/server";
import { verifySelfWebhook } from "@/lib/self";
import { markSelfSessionInvalid, markSelfSessionValid } from "@/lib/selfSessions";

export const runtime = "nodejs";

/**
 * Nimmt die Svix-signierten Webhooks von Self entgegen (in Self's Dashboard
 * als Endpunkt zu hinterlegen: <domain>/api/self/webhook). Der Redirect
 * zurück ins Frontend (successUrl/failureUrl, siehe app/api/self/create-session)
 * ist NICHT vertrauenswürdig - nur dieser signierte Server-zu-Server-Call
 * bestätigt tatsächlich, ob die Verifizierung bestanden wurde, und liefert
 * bei Erfolg den Nullifier (Sybil-Resistenz-Kennung, siehe
 * build/phase9-bastet-2.0-self-gatekeeper.md, Punkt 4 - Cooldown-Logik
 * selbst folgt erst in Phase 9c).
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers = {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };

  let event;
  try {
    event = verifySelfWebhook(rawBody, headers);
  } catch (error) {
    console.error("Self-Webhook: ungültige Signatur/Payload, verworfen:", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "verification.completed") {
    if (event.status === "valid") {
      await markSelfSessionValid(event.external_uuid, event.nullifier);
    } else {
      await markSelfSessionInvalid(event.external_uuid, event.reason);
    }
  }
  // Andere Event-Typen (verification.storage_committed/_failed) betreffen nur
  // Selfs eigene Proof-Ablage, nicht unsere Verifizierungsprüfung - bewusst
  // ignoriert, aber mit 200 quittiert, damit Self sie nicht erneut zustellt.

  return NextResponse.json({ ok: true });
}
