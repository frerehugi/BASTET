import { NextResponse } from "next/server";
import { runInterviewStream } from "@/lib/chat";
import type { ChatMessage } from "@/lib/anthropic";
import { STREAM_ERROR_MARKER } from "@/lib/streamProtocol";

export const runtime = "nodejs";
export const maxDuration = 150;

interface ChatRequestBody {
  messages: ChatMessage[];
  diagnosisConfirmed: boolean;
  turnCount: number;
  /** Kompakter Tier-1-Kontext (siehe lib/triage/context.ts), optional - fehlt
   *  z.B. beim Telegram-Arm, der (noch) keine Tier-1-Ersteinschätzung hat. */
  triageContext?: string | null;
  /** Von computeTriage() berechnete GdB/MdE/EMR-Vorab-Einschätzung, als
   *  Kalibrierungsanker für Tier 2 (siehe lib/triage/context.ts,
   *  triageResultToPromptAnchor()) - wie triageContext optional. */
  triageAnchor?: string | null;
}

export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON." }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: "messages fehlt oder ist ungültig." }, { status: 400 });
  }

  const generator = runInterviewStream(
    body.messages,
    !!body.diagnosisConfirmed,
    typeof body.turnCount === "number" ? body.turnCount : 0,
    typeof body.triageContext === "string" ? body.triageContext : null,
    typeof body.triageAnchor === "string" ? body.triageAnchor : null
  );

  // Erstes Chunk manuell abrufen, BEVOR die Response erstellt wird: ein
  // Fehler VOR Stream-Start (fehlender ANTHROPIC_API_KEY, ungültiger
  // Request) kann so noch als regulärer JSON-Fehler-Response mit Statuscode
  // ausgeliefert werden, wie im bisherigen nicht-streamenden Verhalten -
  // sobald die Response einmal zurückgegeben ist, sind Status/Header fix.
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
        // Fehler MITTEN im Stream (z.B. stop_reason: max_tokens, erst nach
        // dem letzten Chunk bekannt, oder Verbindungsabbruch) - HTTP-Status
        // ist längst 200, daher als Marker ans Stream-Ende angehängt statt
        // als eigener Fehler-Response. app/page.tsx trennt ihn wieder heraus
        // und behandelt ihn wie einen fehlgeschlagenen Request (kein
        // stillschweigender Teilerfolg, siehe lib/anthropic.ts).
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
