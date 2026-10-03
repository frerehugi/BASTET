import type { ChatMessage } from "./anthropic";

// Gemeinsame Budget-Grenzen für offene Interview-Eingaben (Web-Chat +
// Telegram, siehe lib/chat.ts budgetHintFor() und app/api/telegram/route.ts).
// Bewusst an der KUMULIERTEN Zeichenmenge der ganzen Sitzung bemessen, nicht
// an Turn-Zahl oder Länge einzelner Nachrichten: BASTETs Zielgruppe
// (Post-COVID/ME-CFS) ist stark heterogen - manche schaffen wegen Brain Fog
// nur viele kurze Nachrichten-Schübe, andere bereiten bewusst einen langen
// Text vor und fügen ihn in einer Nachricht ein. Beide Stile sind legitim
// und dürfen nicht durch Turn- oder Pro-Nachricht-Grenzen bestraft werden -
// nur die Gesamtmenge über die ganze Sitzung ist das eigentliche Kosten-/
// Missbrauchsrisiko.
//
// SOFT: ab hier bittet der Prompt das Modell, bald zur Auswertung
// überzuleiten (lib/chat.ts). HARD: liegt bewusst deutlich darüber, damit
// dem Modell nach dem weichen Hinweis noch Raum bleibt, tatsächlich
// abzuschließen, bevor app/api/telegram/route.ts weitere Eingaben ablehnt.
export const SESSION_CHAR_SOFT_LIMIT = 18000;
export const SESSION_CHAR_HARD_LIMIT = 25000;

function contentLength(content: ChatMessage["content"]): number {
  if (typeof content === "string") return content.length;
  // ContentBlock[] (Anhänge) kommt im offenen Interview-Flow (Web-Chat/
  // Telegram) ohnehin nicht vor, nur im Doc-Arm - hier rein defensiv nur
  // reine Textblöcke mitzählen.
  return content.reduce((sum, block) => sum + (block.type === "text" ? block.text.length : 0), 0);
}

/** Summe aller Zeichen über die gesamte Nachrichtenliste - Grundlage für die Budget-Grenzen oben. */
export function totalMessageChars(messages: ChatMessage[]): number {
  return messages.reduce((sum, m) => sum + contentLength(m.content), 0);
}
