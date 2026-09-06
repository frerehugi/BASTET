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

export const PATIENT_ABOUT_TEXT = `BASTET ist ein Orientierungs- und Hilfsangebot, keine verbindliche Begutachtung, keine medizinische Diagnose und keine Rechtsberatung. Es ersetzt weder eine ärztliche Untersuchung noch anwaltliche Beratung und bindet keine Behörde, kein Gericht und keinen Versicherungsträger.

BASTET basiert auf großen Sprachmodellen (LLMs) und einer kuratierten Wissensbasis. Diese Technologie befindet sich in aktiver Forschung und Entwicklung, ist experimentell, und fehlerhafte oder unvollständige Ausgaben sind nicht auszuschließen. Für Vollständigkeit, Richtigkeit und Aktualität der Inhalte wird keine Gewähr übernommen. Alle Ausgaben dienen ausschließlich der Orientierung — Nutzer:innen bleiben selbst dafür verantwortlich, Angaben durch qualifizierte Fachpersonen prüfen zu lassen, bevor daraus Entscheidungen abgeleitet werden.

Soweit gesetzlich zulässig, ist eine Haftung für Schäden aus der Nutzung von BASTET ausgeschlossen; dies gilt nicht bei Verletzung von Leben, Körper oder Gesundheit sowie nicht bei Vorsatz oder grober Fahrlässigkeit.

© Schmitz & Hugenberg, Osnabrück. Alle Rechte vorbehalten — an Name, Marke, Quellcode und den redaktionell erstellten Inhalten (u. a. die kuratierte Wissensbasis). Das Repository ist öffentlich einsehbar, insbesondere für die Teilnahme an Hackathons; öffentliche Einsehbarkeit bedeutet nicht automatisch eine Open-Source-Lizenzierung. "Open Source" bezieht sich auf die zugrunde liegenden Quellen und Daten (u. a. VersMedV als amtliches Werk gemäß § 5 UrhG, Kanadische Konsenskriterien, veröffentlichte Sozialgerichtsentscheidungen) — deren Auswahl und Verknüpfung innerhalb von BASTET ist eine eigenständige redaktionelle Leistung.

BASTET ist ein Forschungsprojekt im Aufbau — Funktionsumfang und Wissensbasis entwickeln sich fortlaufend weiter.`;
