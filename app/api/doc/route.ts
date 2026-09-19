import { NextResponse } from "next/server";
import { runDocAssessmentStream, type UploadedFile } from "@/lib/doc";
import { STREAM_ERROR_MARKER } from "@/lib/streamProtocol";

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

  const generator = runDocAssessmentStream(body.userInput, files);

  // Erstes Chunk manuell abrufen, BEVOR die Response erstellt wird: ein
  // Fehler VOR Stream-Start (fehlender ANTHROPIC_API_KEY, ungültiger
  // Request) kann so noch als regulärer JSON-Fehler-Response mit Statuscode
  // ausgeliefert werden, wie im bisherigen nicht-streamenden Verhalten -
  // sobald die Response einmal zurückgegeben ist, sind Status/Header fix.
  // Gleiches Muster wie app/api/chat/route.ts.
  let first: IteratorResult<string, void>;
  try {
    first = await generator.next();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) {
          controller.enqueue(encoder.encode(first.value));
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
          }
        }
      } catch (error) {
        // Fehler MITTEN im Stream (z.B. stop_reason: max_tokens) - HTTP-Status
        // ist längst 200, daher als Marker ans Stream-Ende angehängt statt
        // als eigener Fehler-Response. app/doc/page.tsx trennt ihn wieder
        // heraus (siehe lib/streamProtocol.ts, gleiches Muster wie im
        // Web-Chat-Arm).
        const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
        controller.enqueue(encoder.encode(STREAM_ERROR_MARKER + message));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
