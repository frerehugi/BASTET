import { NextResponse } from "next/server";
import { runInterviewStream } from "@/lib/chat";
import type { ChatMessage } from "@/lib/anthropic";
import { STREAM_ERROR_MARKER } from "@/lib/streamProtocol";
import { REFERENZEN_MARKER } from "@/lib/format";
import { incrementCompleted, incrementStarted } from "@/lib/userCount";

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
  /** true, wenn aus dem Tier-1-Vorlauf bereits sicher bekannt ist, dass kein
   *  beruflicher Zusammenhang besteht (answers.beruflicherKontext === "nein")
   *  - steuert die konservative Wissensbasis-Selektion in lib/chat.ts (siehe
   *  build/effizienz-plan.md Abschnitt 2). Optional, Default false (voller
   *  Bestand, unverändertes Verhalten). */
  beruflicherKontextNein?: boolean;
  /** Zähler für die optionale Vertiefungsrunde nach dem AUSWAHL-CHECKPOINT
   *  (siehe lib/chat.ts) - null/fehlend, solange keine aktive
   *  Vertiefungsrunde läuft (unverändertes Verhalten). */
  extraTurnCount?: number | null;
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

  const turnCount = typeof body.turnCount === "number" ? body.turnCount : 0;
  // "Sitzung gestartet" = erster echter Backend-Call (die Tier-1-Triage davor
  // läuft rein clientseitig, siehe app/page.tsx) - siehe lib/userCount.ts.
  // AWAIT statt void: der nachfolgende Anthropic-Call verzögert sich dadurch
  // nicht spürbar (Redis-INCR ist sehr schnell), garantiert aber, dass der
  // Write wirklich passiert ist - siehe incrementCompleted weiter unten für
  // den Grund, warum void hier riskant wäre.
  if (turnCount === 0) await incrementStarted("web");
  // War in einer vorherigen Runde (z.B. vor einer Rückfrage) schon eine
  // vollständige Auswertung mit REFERENZEN-Block dabei? Nur dann NICHT noch
  // einmal als "completed" zählen, wenn diese Runde erneut einen liefert.
  const alreadyCompleted = body.messages.some(
    (m) => m.role === "assistant" && typeof m.content === "string" && m.content.includes(REFERENZEN_MARKER)
  );

  // Weiche Deadline deutlich VOR `maxDuration` (oben, 150s) - gleiches Muster
  // und gleiche Begründung wie in app/api/doc/route.ts: ohne dieses Signal
  // würde die Vercel-Function bei Überschreiten von maxDuration irgendwann
  // hart beendet, OHNE jede Chance auf eigenen Code (kein catch, kein
  // finally) - der beim Client bereits angekommene Teiltext bliebe dann
  // unkommentiert mitten im Satz stehen, ohne STREAM_ERROR_MARKER. 15s
  // Puffer für den Rest von start() (Fehler-Marker schreiben, Stream
  // schließen, Vercel-Overhead).
  const deadline = new AbortController();
  const deadlineTimer = setTimeout(() => deadline.abort(), 135_000);

  const generator = runInterviewStream(
    body.messages,
    !!body.diagnosisConfirmed,
    turnCount,
    typeof body.triageContext === "string" ? body.triageContext : null,
    typeof body.triageAnchor === "string" ? body.triageAnchor : null,
    !!body.beruflicherKontextNein,
    typeof body.extraTurnCount === "number" ? body.extraTurnCount : null,
    deadline.signal
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
    clearTimeout(deadlineTimer);
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      let streamErrored = false;
      try {
        if (!first.done) {
          full += first.value;
          controller.enqueue(encoder.encode(first.value));
          for await (const chunk of generator) {
            full += chunk;
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
        streamErrored = true;
        const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
        controller.enqueue(encoder.encode(STREAM_ERROR_MARKER + message));
      } finally {
        clearTimeout(deadlineTimer);
        controller.close();
      }
      // Erst NACH controller.close() zählen (siehe lib/userCount.ts) - eine
      // Auswertung gilt erst als "completed", wenn diese Runde tatsächlich
      // (erstmals) einen vollständigen REFERENZEN-Block geliefert hat, ohne
      // Stream-Fehler mittendrin. AWAIT statt void: das ist die letzte
      // Aktion in start() - ohne await kann die Serverless-Function-Instanz
      // (Vercel) beendet werden, sobald der Stream als abgeschlossen gilt,
      // noch bevor der fire-and-forget-Redis-Write beim Provider ankommt.
      // Der Stream selbst ist zu diesem Zeitpunkt schon vollständig an die
      // Person ausgeliefert (controller.close() lief bereits) - das await
      // hier verzögert also nichts Sichtbares, sichert nur den Zähler ab.
      if (!streamErrored && !alreadyCompleted && full.includes(REFERENZEN_MARKER)) {
        await incrementCompleted("web");
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
