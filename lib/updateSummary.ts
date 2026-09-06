import { callClaude } from "./anthropic";

const SUMMARY_SYSTEM_PROMPT = `Du fasst Änderungen auf einer Rechts-/Leitlinien-Quelle für eine Wissensbasis zu
GdB/MdE bei Post-COVID/ME-CFS im deutschen Sozialrecht zusammen. Antworte knapp,
auf Deutsch, in genau diesem Format:

Kernaussage: [1-2 Sätze, was inhaltlich neu/geändert ist]
Betroffene GdB/MdE-Werte: [konkrete Werte/Spannen, falls erkennbar, sonst "nicht erkennbar"]
Datum: [Datum der Änderung/Entscheidung, falls erkennbar, sonst "nicht erkennbar"]
Relevanz für Post-COVID/ME-CFS-Begutachtung: [hoch/mittel/niedrig, mit einem Halbsatz Begründung]

Erfinde nichts, das nicht im gegebenen Text steht. Wenn der Text nicht erkennbar
mit GdB/MdE/Post-COVID/ME-CFS/Sozialrecht zusammenhängt, sag das in der
Kernaussage ausdrücklich statt eine Relevanz zu konstruieren.`;

export async function summarizeSourceChange(sourceLabel: string, rawContent: string, detailUrl: string): Promise<string> {
  const userMessage = `Quelle: ${sourceLabel}\nURL: ${detailUrl}\n\nInhalt (Auszug):\n${rawContent}`;
  return callClaude(SUMMARY_SYSTEM_PROMPT, [{ role: "user", content: userMessage }], 400);
}
