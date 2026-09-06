import { NextRequest, NextResponse } from "next/server";

// Gibt dem Ärzte-Arm eine eigene, für Fachkolleg:innen erwartbare Adresse,
// ohne den Code zu duplizieren oder ein zweites Vercel-Projekt aufzusetzen:
// dieselbe App, zwei Domains, hier die Umschreibung anhand des Hostnamens.
// Betrifft ausschließlich den Root-Pfad auf der Doc-Subdomain — API-Routen,
// Assets und die Hauptdomain (inkl. deren eigenem /doc) bleiben unverändert.
const DOC_HOST = "doc.bastet-covid.org";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "";

  if (hostname === DOC_HOST && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/doc", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
