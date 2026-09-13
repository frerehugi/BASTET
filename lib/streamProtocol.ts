// Von Server (app/api/chat/route.ts) und Client (app/page.tsx) gemeinsam
// genutzter Marker für einen Fehler, der erst MITTEN im Response-Stream
// auftritt (z.B. stop_reason: max_tokens - erst nach dem letzten SSE-Event
// bekannt - oder ein Verbindungsabbruch zur Anthropic-API). HTTP-Status und
// -Header sind zu diesem Zeitpunkt längst gesendet, ein regulärer
// Fehler-Response (wie beim nicht-streamenden Pfad) ist nicht mehr möglich.
// Der Marker wird stattdessen als Textsuffix in den Stream geschrieben und
// clientseitig erkannt/herausgetrennt. Bewusst ein unverwechselbares,
// SCREAMING_SNAKE_CASE-Token ohne Steuerzeichen (die manche Zwischenstationen
// im Response-Body verändern könnten) - im deutschen Fließtext der
// Auswertung oder im strukturierten Ausgabeformat (siehe lib/chat.ts,
// AUSWERTUNGS-FORMAT) kommt so eine Zeichenkette praktisch nie natürlich vor.
export const STREAM_ERROR_MARKER = "\n\n__BASTET_STREAM_ERROR__\n";

export function splitStreamError(fullText: string): { text: string; error: string | null } {
  const idx = fullText.indexOf(STREAM_ERROR_MARKER);
  if (idx === -1) return { text: fullText, error: null };
  return {
    text: fullText.slice(0, idx),
    error: fullText.slice(idx + STREAM_ERROR_MARKER.length).trim() || "Unbekannter Fehler beim Streaming.",
  };
}
