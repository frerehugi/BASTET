/**
 * Text, den mehrere Arme identisch zeigen sollen, an einer Stelle gepflegt,
 * damit sie nicht auseinanderlaufen: PATIENT_TITLE/-SUBTITLE und CRISIS_NOTE
 * für Web- und Telegram-Arm des Betroffenen-Zweigs, PATIENT_ABOUT_TEXT
 * (Rechtliches/Über-BASTET) zusätzlich auch für den Ärzte-Arm (app/doc/page.tsx).
 *
 * Die *_EN-Pendants (03.10.2026) sind für den zweisprachigen Telegram-Arm
 * (app/api/telegram/route.ts, /language-Befehl) - bewusst nur dort genutzt,
 * der Web-Arm (app/page.tsx) bleibt vorerst Deutsch-only und importiert
 * weiterhin nur die deutschen Konstanten.
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

// Separat exportiert (statt nur inline in PATIENT_ABOUT_TEXT), damit die
// Web-Arme (app/page.tsx, app/doc/page.tsx) die Adresse für den
// Kopieren-Button referenzieren können, ohne sie ein zweites Mal
// abzutippen — Telegram zeigt weiterhin nur den vollen Fließtext.
export const BASTET_WALLET_ADDRESS = "0x593BA829D84F9bC3AeF2a507C5cf6Cc4dC2c3608";

export const PATIENT_ABOUT_TEXT = `BASTET ist ein Orientierungs- und Hilfsangebot und liefert keine verbindliche Begutachtung, keine medizinische Diagnose und keine Rechtsberatung. Es ersetzt weder eine ärztliche Untersuchung noch anwaltliche Beratungen und bindet keine Behörde, kein Gericht und keinen Versicherungsträger.

BASTET basiert auf großen Sprachmodellen (LLMs) und einer kuratierten Wissensbasis. Aktuell nutzt BASTET die Claude API von Anthropic. Diese Technologie befindet sich in aktiver Forschung und Entwicklung, ist experimentell, und fehlerhafte oder unvollständige Ausgaben sind nicht auszuschließen, Funktionsumfang und Wissensbasis entwickeln sich fortlaufend weiter. Für Vollständigkeit, Richtigkeit und Aktualität der Inhalte wird keine Gewähr übernommen. Alle Ausgaben dienen ausschließlich der fachlichen Orientierung — die eigene fachliche Beurteilung bleibt maßgeblich.

Die Nutzung von BASTET ist freiwillig und darf grundsätzlich nur unter Berücksichtigung der zuvor genannten Einschränkungen erfolgen. Soweit gesetzlich zulässig, ist eine Haftung für Schäden aus der Nutzung von BASTET ausgeschlossen.

BASTET ist ein Open Source Projekt, "Open Source" bezieht sich hierbei auf die zugrunde liegenden Quellen und Daten (u. a. VersMedV als amtliches Werk gemäß § 5 UrhG, Kanadische Konsenskriterien, veröffentlichte Sozialgerichtsentscheidungen etc.) — deren Auswahl und Verknüpfung innerhalb von BASTET ist eine eigenständige redaktionelle Leistung.

BASTET ist ein privates Community-Projekt von und für Post-COVID/MECFS Betroffene, die Kosten für die Nutzung der Anthropic-Dienste sowie des Webhostings werden aktuell vollständig privat getragen. Über die IDs 9817 und 9818 ist BASTET als ERC-8004 Bot über CELO mit eigener Wallet gelistet, wer das Projekt unterstützen möchte, der kann dies über die nachfolgenden Netzwerke tun.

BASTET Ethereum Wallet (ETH, CELO, BASE etc): ${BASTET_WALLET_ADDRESS}

Für Fragen und Anregungen benutzen Sie bitte diesen Telegram Kanal: https://t.me/bastet_covid`;

// --- Englische Pendants (zweisprachiger Telegram-Arm, 03.10.2026) ----------

export const PATIENT_TITLE_EN = "Post-COVID / ME-CFS Pre-Assessment";

export const PATIENT_SUBTITLE_EN =
  "An orientational, AI-assisted initial assessment — not a substitute for medical or legal advice.";

export const DIAGNOSIS_WARNING_EN =
  "This is not medical advice and cannot provide or replace a diagnosis. Without a confirmed diagnosis, a medical examination is required.";

export const CRISIS_NOTE_EN =
  "If you are currently in crisis or thinking about harming yourself: in Germany, the Telefonseelsorge is available free of charge and anonymously at 0800 111 0 111 or 0800 111 0 222 (German-language, around the clock). English-language crisis support can be found via your embassy or international crisis lines.";

export const PATIENT_ABOUT_TEXT_EN = `BASTET is an orientation and support service and does not provide a binding assessment, medical diagnosis, or legal advice. It does not replace a medical examination or legal counsel, and does not bind any authority, court, or insurance carrier.

BASTET is based on large language models (LLMs) and a curated knowledge base. It currently uses Anthropic's Claude API. This technology is under active research and development, is experimental, and faulty or incomplete output cannot be ruled out; its feature set and knowledge base keep evolving. No guarantee is given for the completeness, correctness, or currency of the content. All output serves purely as professional orientation — your own professional judgment remains decisive.

Using BASTET is voluntary and should only happen with the above limitations in mind. To the extent legally permitted, liability for damages arising from the use of BASTET is excluded.

BASTET is an open-source project — "open source" here refers to the underlying sources and data (among others the VersMedV, an official German work under § 5 UrhG, the Canadian Consensus Criteria, published German social-court decisions, etc.); their selection and combination within BASTET is an independent editorial effort.

BASTET is a private community project by and for people affected by Post-COVID/ME-CFS; the costs of using the Anthropic services and web hosting are currently borne entirely privately. Under IDs 9817 and 9818, BASTET is listed as an ERC-8004 bot on Celo with its own wallet — if you would like to support the project, you can do so via the networks below.

BASTET Ethereum wallet (ETH, Celo, Base etc.): ${BASTET_WALLET_ADDRESS}

For questions and feedback, please use this Telegram channel: https://t.me/bastet_covid`;
