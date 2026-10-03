// Gemeinsamer Sprach-Typ für alles, was zwischen lib/chat.ts (System-Prompt-
// Varianten), lib/content.ts (statische Texte) und app/api/telegram/route.ts
// (Session-Feld, /language-Befehl) geteilt werden muss - eigene, winzige
// Datei statt eines Imports aus lib/chat.ts in lib/telegramSession.ts, damit
// die Session-Speicherschicht nicht von der Interview-Logik abhängt.
export type Lang = "de" | "en";
