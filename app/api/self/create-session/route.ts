import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { isSelfEnabled, type SelfArm } from "@/lib/selfFeatureFlag";
import { createSelfVerificationSession } from "@/lib/self";

export const runtime = "nodejs";

interface CreateSessionBody {
  /** Pfad auf DERSELBEN Domain, zu dem nach der Verifizierung zurückgesprungen wird (Default "/"). */
  returnPath?: string;
  /** Welcher Arm gated werden soll - Web (Tier 2) und Doc-Arm haben seit
   *  9d getrennte Ein-/Ausschalter (siehe lib/selfFeatureFlag.ts), da
   *  Florian den Doc-Arm zuerst und unabhängig vom Web-Arm aktivieren
   *  wollte. Kein gültiger Wert -> wie ausgeschaltet behandeln, nicht als
   *  Fehler (fail-safe wie überall sonst in dieser Route). */
  arm?: string;
}

function parseArm(raw: string | undefined): SelfArm | null {
  return raw === "web" || raw === "doc" ? raw : null;
}

// Nur ein relativer, eigener Pfad ist erlaubt - niemals ungeprüft aus dem
// Request-Body eine Redirect-URL bauen, sonst ließe sich diese Route für
// einen Open Redirect missbrauchen (z. B. returnPath: "//evil.example").
function sanitizeReturnPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return "/";
  return raw;
}

/**
 * Legt bei aktivierter Self-Verifizierung (lib/selfFeatureFlag.ts) eine neue
 * Verifizierungs-Session an und gibt die von Self gehostete
 * `verificationUrl` zurück, zu der das Frontend weiterleitet. Ist Self
 * ausgeschaltet oder nicht konfiguriert, liefert diese Route lediglich
 * `{ enabled: false }` zurück - der Aufrufer (app/page.tsx) fällt dann auf
 * den unveränderten Tier-2-Start ohne jede Verifizierung zurück. Genau
 * dieser Rückfall ist das gewünschte "schalte Self aus -> alter Zustand".
 */
export async function POST(request: NextRequest) {
  const body: CreateSessionBody = await request.json().catch(() => ({}));
  const arm = parseArm(body.arm);
  if (!arm) {
    return NextResponse.json({ enabled: false });
  }

  const enabled = await isSelfEnabled(arm);
  if (!enabled) {
    return NextResponse.json({ enabled: false });
  }

  const returnPath = sanitizeReturnPath(body.returnPath);
  const origin = request.nextUrl.origin;
  const externalUuid = randomUUID();

  try {
    const session = await createSelfVerificationSession({
      externalUuid,
      successUrl: `${origin}${returnPath}?self=${externalUuid}`,
      failureUrl: `${origin}${returnPath}?self=${externalUuid}&selfOutcome=failure`,
    });
    return NextResponse.json({ enabled: true, id: externalUuid, verificationUrl: session.verificationUrl });
  } catch (error) {
    console.error("Self-Session konnte nicht angelegt werden:", error);
    // Fail-safe wie oben: ein Fehler bei Self darf Tier 2/den Doc-Arm nicht
    // blockieren, sondern degradiert auf "wie ausgeschaltet".
    return NextResponse.json({ enabled: false });
  }
}
