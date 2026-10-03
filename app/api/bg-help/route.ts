import { NextResponse } from "next/server";
import { runBgHelpStream } from "@/lib/chat";
import type { ChatMessage } from "@/lib/anthropic";
import { STREAM_ERROR_MARKER } from "@/lib/streamProtocol";

export const runtime = "nodejs";
export const maxDuration = 150;

interface BgHelpRequestBody {
  messages: ChatMessage[];
  /** Reiner Anzeigetext der bereits erstellten Auswertung (ohne
   *  REFERENZEN-Block - siehe splitReferences() in lib/format.ts), damit
   *  Antworten sich auf den konkreten Fall beziehen können. Optional, falls
   *  der Button ohne vorherigen Auswertungskontext erreicht wird. */
  evaluationContext?: string | null;
}

// Struktur bewusst identisch zu app/api/chat/route.ts gehalten (gleiches
// Stream-Fehlerprotokoll, gleiche Vorab-Chunk-Prüfung) - siehe dortige
// Kommentare für die Begründung der einzelnen Schritte.
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

  // Weiche Deadline deutlich VOR `maxDuration` (oben, 150s) - gleiches Muster
  // wie app/api/chat/route.ts/app/api/doc/route.ts (siehe dortige Kommentare
  // für die Begründung).
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), 135_000);

  const generator = runBgHelpStream(
    body.messages,
    typeof body.evaluationContext === "string" ? body.evaluationContext : null,
    deadline.signal
  );

  let first: IteratorResult<string, void>;
  try {
    first = await generator.next();
  } catch (error) {
    clearTimeout(deadlineTimer);
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
        const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
        controller.enqueue(encoder.encode(STREAM_ERROR_MARKER + message));
      } finally {
        clearTimeout(deadlineTimer);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
