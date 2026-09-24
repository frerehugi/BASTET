/**
 * Text, das Web- und Telegram-Arm des Betroffenen-Zweigs identisch zeigen
 * sollen — Titel/Untertitel, Rechtliches/Über-BASTET und der Krisenhinweis.
 * An einer Stelle gepflegt, damit beide Kanäle nicht auseinanderlaufen.
 */

// Ohne "BASTET —"-Präfix, da der Web-Arm den Wordmark schon in der Kopfzeile
// zeigt (app/layout.tsx). Kanäle ohne persistente Kopfzeile (Telegram) setzen
// das Präfix selbst davor.
export const PATIENT_TITLE = "Vorbegutachtung Post-COVID / ME-CFS";

export const PATIENT_SUBTITLE =
  "Eine orientierende, KI-gestützte Ersteinschätzung — kein Ersatz für ärztliche oder rechtliche Beratung.";

export const DIAGNOSIS_WARNING =
  "Dies ist keine medizinische Beratung und kann keine Diagnose stellen oder ersetzen. Ohne gesicherte Diagnose ist eine ärztliche Untersuchung erforderlich.";

export const CRISIS_NOTE =
  "Falls Sie sich gerade in einer Krise befinden oder daran denken, sich etwas anzutun: Die Telefonseelsorge erreichen Sie kostenlos und anonym unter 0800 111 0 111 oder 0800 111 0 222, rund um die Uhr.";

export const PATIENT_ABOUT_TEXT = `BASTET ist ein Orientierungs- und Hilfsangebot und liefert keine verbindliche Begutachtung, keine medizinische Diagnose und keine Rechtsberatung. Es ersetzt weder eine ärztliche Untersuchung noch anwaltliche Beratungen und bindet keine Behörde, kein Gericht und keinen Versicherungsträger.

BASTET basiert auf großen Sprachmodellen (LLMs) und einer kuratierten Wissensbasis. Aktuell nutzt BASTET die Claude API von Anthropic. Diese Technologie befindet sich in aktiver Forschung und Entwicklung, ist experimentell, und fehlerhafte oder unvollständige Ausgaben sind nicht auszuschließen, Funktionsumfang und Wissensbasis entwickeln sich fortlaufend weiter. Für Vollständigkeit, Richtigkeit und Aktualität der Inhalte wird keine Gewähr übernommen. Alle Ausgaben dienen ausschließlich der fachlichen Orientierung — die eigene fachliche Beurteilung bleibt maßgeblich.

Die Nutzung von BASTET ist freiwillig und darf grundsätzlich nur unter Berücksichtigung der zuvor genannten Einschränkungen erfolgen. Soweit gesetzlich zulässig, ist eine Haftung für Schäden aus der Nutzung von BASTET ausgeschlossen.

BASTET ist ein Open Source Projekt, "Open Source" bezieht sich hierbei auf die zugrunde liegenden Quellen und Daten (u. a. VersMedV als amtliches Werk gemäß § 5 UrhG, Kanadische Konsenskriterien, veröffentlichte Sozialgerichtsentscheidungen etc.) — deren Auswahl und Verknüpfung innerhalb von BASTET ist eine eigenständige redaktionelle Leistung.

BASTET ist ein privates Community-Projekt von und für Post-COVID/MECFS Betroffene, die Kosten für die Nutzung der Anthropic-Dienste sowie des Webhostings werden aktuell vollständig privat getragen. Über die IDs 9817 und 9818 ist BASTET als ERC-8004 Bot über CELO mit eigener Wallet gelistet, wer das Projekt unterstützen möchte, der kann dies über die nachfolgenden Netzwerke tun.

BASTET Ethereum Wallet (ETH, CELO, Base etc): 0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608`;
