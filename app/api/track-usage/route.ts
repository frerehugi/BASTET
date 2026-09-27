import { NextRequest, NextResponse } from "next/server";
import { incrementCompleted, incrementStarted, type UserCountArm } from "@/lib/userCount";

// Ehemals app/api/track-tier1 - umbenannt und auf einen zweiten Arm
// erweitert ("landing", siehe app/page.tsx: Klick auf "Starte BASTET"),
// nachdem Florian darauf hinwies, dass genau dieser Klick bislang gar nicht
// gezählt wurde - zwischen ihm und dem tatsächlichen Tier-1-Start
// (trackierter Zähler "tier1") liegen die Diagnose-Gate-/Warnhinweis-
// Bildschirme, an denen Personen aussteigen können, ohne je Tier 1 zu
// erreichen ("Ich möchte erst zum Arzt"). Beide Arme bleiben rein
// clientseitig/kostenlos, das hier ist nur ein anonymer Zähler (Redis-INCR
// über lib/userCount.ts), kein Anthropic-Call, keine Speicherung von
// Antworten/Inhalten. Siehe build/phase9-bastet-2.0-self-gatekeeper.md,
// Abschnitt Tier-1-Qualität.
export const runtime = "nodejs";

const TRACKABLE_ARMS: UserCountArm[] = ["tier1", "landing", "arztVerweis"];

interface TrackUsageBody {
  /** Default "tier1" - Rückwärtskompatibilität zum alten track-tier1-Aufruf. */
  arm?: string;
  event?: "started" | "completed";
}

export async function POST(request: NextRequest) {
  const body: TrackUsageBody = await request.json().catch(() => ({}));
  const arm = body.arm ?? "tier1";

  // Unbekannter/fehlerhafter arm-Wert wird still ignoriert statt einen
  // Fehler zu werfen - ein kaputter Aufruf darf dem Frontend nie auffallen.
  // AWAIT bewusst statt void/fire-and-forget: diese Route hat danach keine
  // weitere Arbeit mehr, die den Redis-Write "nebenbei" Zeit geben würde -
  // ohne await kann die Serverless-Function-Instanz beendet werden, bevor
  // der INCR beim Provider ankommt (beobachtet: Web-Arm "abgeschlossen"
  // blieb trotz erfolgreicher Auswertung bei 0, siehe dieselbe Korrektur in
  // app/api/chat/route.ts, app/api/doc/route.ts, app/api/telegram/route.ts).
  if (TRACKABLE_ARMS.includes(arm as UserCountArm)) {
    const validArm = arm as UserCountArm;
    if (body.event === "started") {
      await incrementStarted(validArm);
    } else if (body.event === "completed") {
      await incrementCompleted(validArm);
    }
  }

  // Immer 204, egal ob der Zähler geklappt hat - eine fehlgeschlagene
  // Zählung darf dem Frontend nie als Fehler auffallen.
  return new NextResponse(null, { status: 204 });
}
