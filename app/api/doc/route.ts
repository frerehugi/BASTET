import { NextResponse } from "next/server";
import { runDocAssessment, type UploadedFile } from "@/lib/doc";

export const runtime = "nodejs";
export const maxDuration = 150;

// Server-seitige Grenzen für Datei-Uploads ("weitere Befunde", siehe
// app/doc/page.tsx) - client-seitig bereits durchgesetzt (inkl. Bild-
// Verkleinerung vor dem Base64-Encoding), hier zusätzlich geprüft, falls die
// Anfrage nicht über die eigene Oberfläche kommt. Werte bewusst konservativ:
// Vercel-Functions begrenzen den Request-Body auf ca. 4,5 MB - Base64 bläht
// Binärdaten um ca. 1/3 auf, die Grenzen hier bleiben mit Puffer für JSON-
// Overhead und die Freitext-Felder deutlich darunter.
const ALLOWED_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_FILES = 4;
const MAX_SINGLE_FILE_BASE64_CHARS = 4_000_000; // ~3 MB Rohgröße
const MAX_TOTAL_BASE64_CHARS = 4_500_000; // ~3,4 MB Rohgröße gesamt

interface DocRequestBody {
  userInput: string;
  files?: UploadedFile[];
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

  const files = body.files;
  if (files !== undefined) {
    if (!Array.isArray(files)) {
      return NextResponse.json({ error: "files muss ein Array sein." }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Höchstens ${MAX_FILES} Dateien pro Anfrage.` }, { status: 400 });
    }
    let totalChars = 0;
    for (const file of files) {
      if (
        !file ||
        typeof file.mediaType !== "string" ||
        typeof file.data !== "string" ||
        !ALLOWED_MEDIA_TYPES.has(file.mediaType) ||
        !file.data
      ) {
        return NextResponse.json(
          { error: "Ungültige Datei (erlaubt: PNG, JPEG, WebP, PDF)." },
          { status: 400 }
        );
      }
      if (file.data.length > MAX_SINGLE_FILE_BASE64_CHARS) {
        return NextResponse.json({ error: "Eine Datei ist zu groß (max. ca. 3 MB pro Datei)." }, { status: 400 });
      }
      totalChars += file.data.length;
    }
    if (totalChars > MAX_TOTAL_BASE64_CHARS) {
      return NextResponse.json(
        { error: "Die Dateien sind in Summe zu groß (max. ca. 3,4 MB insgesamt)." },
        { status: 400 }
      );
    }
  }

  try {
    const text = await runDocAssessment(body.userInput, files);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
