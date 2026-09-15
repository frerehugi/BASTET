import { NextResponse } from "next/server";
import { runBgHelpStream } from "@/lib/chat";
import type { ChatMessage } from "@/lib/anthropic";
import { STREAM_ERROR_MARKER } from "@/lib/streamProtocol";

export const runtime = "nodejs";
export const maxDuration = 150;

interface BgHelpRequestBody {
  messages: ChatMessage[];
  /** Reiner Anzeigetext der bereits erstellten Auswertung (ohne
   *  REFERENZEN-Block, siehe app/page.tsx sendBgHelpMessage), als Kontext
   *  für die Antworten - optional, falls z.B. noch keine Auswertung vorliegt. */
  evaluationContext?: string | null;
}

export async function POST(request: Request) {
  let body: BgHelpRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages fehlt oder ist ungültig." }, { status: 400 });
  }

  const generator = runBgHelpStream(
    body.messages,
    typeof body.evaluationContext === "string" ? body.evaluationContext : null
  );

  // Gleiches Muster wie app/api/chat/route.ts: erstes Chunk manuell abrufen,
  // BEVOR die Response erstellt wird, damit ein Fehler VOR Stream-Start
  // (fehlender ANTHROPIC_API_KEY, ungültiger Request) noch als regulärer
  // JSON-Fehler-Response mit Statuscode ausgeliefert werden kann.
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
        // Fehler MITTEN im Stream - HTTP-Status ist längst 200, daher als
        // Marker ans Stream-Ende angehängt statt als eigener Fehler-Response
        // (siehe app/api/chat/route.ts, app/page.tsx trennt ihn wieder heraus).
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
