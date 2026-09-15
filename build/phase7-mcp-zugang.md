# Phase 7 — MCP-Zugang: BASTET direkt aus fremden KI-Chatfenstern nutzbar machen

**Status**: Plan, keine Umsetzung. Reines Konzeptdokument für eine spätere Phase — kommt nach Phase 3 (ERC-8004, erledigt) und vermutlich nach Phase 4 (x402, geplant, noch nicht gebaut).

## Warum das nötig ist — die Lücke zwischen Phase 3/4 und "echtem" Agentenzugang

ERC-8004 (Phase 3) klärt **Identität** ("wer ist BASTET, ist das vertrauenswürdig"). x402 (Phase 4) klärt **Bezahlung** ("wie fließt Geld, falls nötig"). Keins von beidem klärt **Aufruf**: Die in den ERC-8004-Metadaten hinterlegten `services`-Einträge (`/chat`, `/doc`) sind reine URLs zu euren eigenen, für das Next.js-Frontend gebauten REST-Endpoints — ohne veröffentlichtes Schema. Ein fremder Agent, der BASTET über die Registry findet, weiß "es gibt da was", aber nicht, wie er sinnvoll damit sprechen soll, ohne eure interne API-Struktur zu kennen oder zu raten.

**Ziel dieser Phase**: Ein Nutzer soll BASTET direkt aus seinem eigenen KI-Chatfenster heraus benutzen können — sein Agent ruft BASTET im Hintergrund auf, der Mensch sieht nur seinen eigenen Chat. Der Standardweg dafür ist ein **MCP-Server** (Model Context Protocol) — das offene Protokoll, über das KI-Clients (Claude und andere) strukturiert mit Drittanbieter-Diensten sprechen, mit klar beschriebenen Tools statt geratener REST-Aufrufe.

## Architekturentscheidung: zustandslos, auf bestehender Logik aufsetzen

Kein neuer Session-Speicher, keine Parallel-Implementierung der Interview-Logik. Der MCP-Server ist eine **dünne Adapterschicht** über `lib/chat.ts`, `lib/doc.ts` und `lib/triage/*` — denselben Kernfunktionen, die Web-, Telegram- und Doc-Arm bereits nutzen. Der aufrufende Agent hält den Gesprächskontext selbst (er hat ja bereits den vollen Chatverlauf mit seinem Nutzer) und schickt bei jedem Tool-Aufruf die bisherigen Angaben mit — analog zum Web-Chat-Arm, der ebenfalls die volle Nachrichtenhistorie pro Request mitschickt, nicht wie Telegram mit serverseitigem Session-Speicher. Das passt auch am besten zum bestehenden No-Storage-Versprechen: BASTET muss dafür nichts Neues vorhalten.

## Design-Weggabelung: Interview-Nachbau vs. Ein-Schuss-Bewertung

Zwei grundsätzlich verschiedene Interaktionsmuster sind denkbar, das ist **die wichtigste Entscheidung vor dem Bauen**:

**Option A — Turn-by-Turn-Nachbau des UI-Flows**: Tools wie `bastet_schnelltest` (Tier 1, strukturierte Antworten) und `bastet_naechste_frage`/`bastet_antwort` (Tier 2, ein Frage-Antwort-Zyklus pro Tool-Aufruf) — spiegelt exakt das bestehende Web-Erlebnis.

**Option B — Ein-Schuss-Bewertung**: Ein einziges Tool `bastet_einschaetzung`, das eine bereits vom aufrufenden Agenten zusammengetragene Symptombeschreibung (Freitext, ggf. aus einem längeren vorherigen Gespräch des Nutzers mit seinem eigenen Agenten) entgegennimmt und direkt eine vollständige GdB-/MdE-/EMR-Einschätzung liefert.

Option B ist vermutlich näher an der tatsächlichen Nutzung: Ein Agent-zu-Agent-Aufruf folgt selten dem Turn-by-Turn-Muster einer Mensch-Oberfläche, und der aufrufende Agent hat oft schon relevante Informationen aus seinem eigenen Gespräch gesammelt. Empfehlung: **mit Option B starten**, Option A nur ergänzen, falls sich in der Praxis zeigt, dass eine geführte Nachfrage (wie bei PEM-Latenz, Schmerzdomänen etc.) für die Ergebnisqualität nötig ist — das lässt sich auch über ein optionales `rueckfragen`-Feld in der Tool-Antwort lösen (das Tool antwortet mit einer vorläufigen Einschätzung *und* offenen Rückfragen, die der aufrufende Agent seinem Nutzer stellen und in einem zweiten Tool-Aufruf nachliefern kann), statt einen komplett separaten Turn-by-Turn-Modus zu bauen.

## Kritischer Punkt, der über generische MCP-Server-Praxis hinausgeht: Disclaimer-Verankerung

Heute erzwingt die Web-UI, dass Haftungsausschluss und "keine Diagnose, keine Rechtsberatung" sichtbar sind (`ABOUT_TEXT`, `PATIENT_ABOUT_TEXT`). Über MCP entscheidet der **aufrufende Agent**, was er seinem Nutzer zeigt — BASTET hat keine Garantie, dass der Disclaimer durchgereicht wird. Das ist kein hypothetisches Risiko, sondern eine reale Verschiebung der Kontrolle über die Darstellung, mit denselben RDG-Sensibilitäten, die schon beim Markteinführungsplan aufkamen (Anfang dieses Chats) — hier verschärft, weil BASTET die Ausgabe gar nicht mehr selbst rendert.

Empfohlene Mitigation, nicht optional:
- Jede Tool-Antwort enthält den Disclaimer als **eigenes strukturiertes Feld** (`orientierungshinweis: string`, `ist_keine_diagnose: true`), nicht nur als Fließtext-Anhang, den ein Agent leicht weglässt.
- Die Tool-Beschreibung selbst (das, was der aufrufende Agent bei der Tool-Auswahl liest) instruiert bereits, dass der Hinweis dem Menschen mitgeteilt werden soll.
- Diese Feldstruktur vor dem Bauen mit Blick auf MCP-Best-Practices für "sensitive domain tools" gegenrechnen (zum Zeitpunkt der Umsetzung aktuell recherchieren, nicht aus diesem Dokument kopieren — ähnliche Vorsicht wie beim x402-SKILL.md-Hinweis in Phase 4).

## Kritischer Punkt: Kosten-/Missbrauchsschutz bei offener Auffindbarkeit

BASTET zahlt für jeden Tier-2-Aufruf echte Anthropic-API-Kosten. Ein öffentlich über ERC-8004 auffindbarer, unauthentifizierter MCP-Server ist potenziell ein offener Kostenhahn für beliebige fremde Agenten — anders als der Web-/Telegram-Arm, der durch die UI natürliche Nutzungsfriktion hat. Vor dem Bauen zu klären:
- Rate-Limiting pro aufrufendem Agent/IP (technisch: z. B. über dieselbe Vercel-KV-Infrastruktur, die schon für Telegram-Sessions existiert, als Zähler statt als Session-Speicher).
- Ob ein einfacher, weiterhin kostenloser API-Key-Mechanismus sinnvoll ist (kein Zahlungsgate, nur Missbrauchsschutz) — spannt sich nicht gegen die "kostenfrei"-Philosophie, ist nur ein Rate-Limit-Anker statt eines Bezahlmodells.
- Ein Tagesbudget-Alarm (Anthropic-API-Ausgaben), analog zur bereits im Effizienzplan diskutierten Kostenkontrolle.

## Phasenplan (Entwurf)

- **7a — Server-Grundgerüst**: Neue Route (z. B. `app/api/mcp/route.ts`), offizielles MCP-TypeScript-SDK, Streamable-HTTP-Transport. Vor dem Coden: aktuelle Next.js-Kompatibilitätshinweise des SDK live nachschlagen (Runtime-Wahl auf Vercel prüfen), nicht aus diesem Dokument annehmen. Zunächst ganz ohne Tools, nur Protokoll-Handshake zum Testen.
- **7b — Erstes Tool**: `bastet_einschaetzung` (Option B, siehe oben), ruft intern dieselbe Logik wie `lib/chat.ts` auf. Disclaimer-Feldstruktur (siehe oben) von Anfang an mit, nicht nachträglich.
- **7c — Kosten-/Missbrauchsschutz**: Rate-Limiting scharf schalten, bevor die Route öffentlich beworben/verlinkt wird.
- **7d — Discovery**: ERC-8004-Metadaten um den MCP-Endpoint ergänzen (prüfen, ob die Identity Registry ein Metadaten-Update nach Erstregistrierung erlaubt, oder ob eine erneute Registrierung nötig wäre); optional zusätzlich ein `.well-known`-Discovery-Dokument auf `bastet-covid.org`, damit Agenten BASTET auch ohne ERC-8004-Registry-Suche finden.
- **7e — Optionales Premium-Tool** (erst nach Phase 4/x402): eine kostenpflichtige Tool-Variante (z. B. "vollständige PDF-Zusammenfassung mit Referenzen", analog zum in Phase 4 skizzierten `/api/premium`), gated über denselben x402-Facilitator. Kein eigenständiger Zahlungsweg, sondern Wiederverwendung von Phase 4.

## Offene Entscheidungen vor dem Start (von Florian zu klären)

- [ ] Option A vs. B (Empfehlung: B, siehe oben) — endgültig bestätigen
- [ ] Rate-Limit-Schwelle und ob dafür ein (weiterhin kostenloser) API-Key eingeführt wird
- [ ] Ob ein Tagesbudget-Alarm für Anthropic-API-Kosten eingerichtet wird, bevor der Endpoint öffentlich beworben wird
- [ ] Rechtliche Einschätzung (Schmitz & Hugenberg), ob die Kontrollverschiebung über die Ausgabedarstellung (siehe Disclaimer-Abschnitt) zusätzliche Absicherung braucht, über die bestehende NOTICE.md/ABOUT_TEXT-Formulierung hinaus
- [ ] Zeitliche Reihenfolge zu Phase 4 (x402) — parallel möglich, aber Phase 7e setzt Phase 4 voraus
