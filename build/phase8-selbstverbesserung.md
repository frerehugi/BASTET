# Phase 8 — Selbstverbesserung: Live-Lücken + aktive Websuche nach harten Kriterien

**Status**: Plan, keine Umsetzung. Baut auf einer bereits bestehenden, produktiven Pipeline auf (siehe Gesamtbild unten) — keine neue Infrastruktur, sondern zwei zusätzliche Signalquellen für dieselbe Pipeline plus ein fehlendes zweites Speicher-Level.

## Gesamtbild — was bereits existiert (nicht neu bauen)

BASTET hat schon eine funktionierende Update-Pipeline, die genau das im Kern tut, wonach hier gefragt wird. Bevor irgendetwas Neues entworfen wird, der bestehende Kreislauf:

1. **`app/api/cron/check-updates`** (wöchentlich, `vercel.json`) prüft 5 fest hinterlegte Quellen (`lib/updateSources.ts`: BSG-RSS, sozialgerichtsbarkeit.de, DGUV, AWMF-Leitlinie, VersMedV-Volltext) per Hash- oder RSS-Fingerprint auf Änderung.
2. Bei Änderung fasst `lib/updateSummary.ts` den neuen Inhalt per LLM zusammen — mit einem bewusst eng geführten System-Prompt ("Erfinde nichts, das nicht im gegebenen Text steht").
3. Die Zusammenfassung landet als `PendingItem` in einer Redis-Review-Queue (`lib/reviewQueue.ts`, Upstash).
4. Der Admin wird per Telegram benachrichtigt (`lib/adminCommands.ts`, `notifyAdminOfPendingItem`).
5. Freigabe/Ablehnung läuft über Telegram-Textkommandos ("freigeben `<id>`" / "ablehnen `<id> [Grund]`").
6. Freigegebene Einträge werden als `AddendumItem` gespeichert und über `getApprovedAddendumText()` als **eigener, ungecachter Textblock** in jeden Chat-/Doc-System-Prompt eingefügt (`lib/knowledgeBase.ts` → `lib/chat.ts`/`lib/doc.ts`, Abschnitt "AKTUALISIERUNGEN DER WISSENSBASIS (nach menschlicher Freigabe)").

Das ist also bereits: automatisch erkennen → LLM-gestützt zusammenfassen → Mensch entscheidet → gespeichert und live im Prompt wirksam. Phase 8 erweitert dieses Muster um zwei neue Eingänge in dieselbe Queue (statt einer Parallelstruktur) und behebt eine Lücke im Speichermodell (siehe unten).

## Neue Signalquelle A — Live-Lückenerkennung aus echten Anfragen

Wie besprochen: Wenn BASTET während eines Gesprächs erkennt, dass eine Frage nicht durch die Wissensbasis abgedeckt ist (kein Treffer in `lib/knowledge/*`, unsicherer Score, wiederkehrendes Randthema), schreibt es einen **anonymisierten Hinweis** — kein Rohtext des Gesprächs, keine Gesundheitsangaben, nur das erkannte Muster (z. B. "wiederholt gefragt: MdE-Bewertung bei POTS ohne begleitendes ME/CFS") — als neuen `PendingItem`-Typ (`sourceId: "usage-gap"`) in dieselbe Queue. Kein Auto-Fund einer Antwort, nur ein Hinweis "hier fehlt evtl. etwas" für den Menschen.

Das respektiert das No-Storage-Prinzip: Es wird nichts vom eigentlichen Gespräch persistiert, nur ein abstrahiertes, PII-freies Themen-Signal.

## Neue Signalquelle B — aktive Websuche nach harten wissenschaftlichen Kriterien

Der entscheidende Unterschied zur bestehenden Pipeline: `UPDATE_SOURCES` beobachtet nur 5 **fest bekannte** URLs auf Änderung. Es entdeckt nichts *Neues* (neue Studien, neue Fallzahlen, neue Leitlinien außerhalb der bekannten 5 Quellen). Das ist die eigentliche Lücke, die "regelmäßige Websuche" schließen soll.

**Vorschlag**: Ein zusätzlicher, seltener laufender Cron-Job (z. B. monatlich, nicht wöchentlich — Kostengründe, siehe unten), der gezielte Suchanfragen zu einer festen Themenliste absetzt (abgeleitet aus `lib/knowledge/quellen.md`: Post-COVID/ME-CFS-Prävalenz, BK-3101-Fallzahlen, VersMedV-Novellierungen, neue Sozialgerichtsentscheidungen, CCC/PEM-Forschung) und die Treffer durch den unten stehenden Kriterienfilter schickt, bevor überhaupt etwas als `PendingItem` in die Queue kommt.

## Harte wissenschaftliche Kriterien — konkrete Checkliste (nicht optional, sonst wiederholt sich diese Session)

Diese Kriterien sind kein generisches "Qualität prüfen", sondern direkt aus den in dieser Session tatsächlich gefundenen Fehlern abgeleitet (Fußnoten-Fehlzuschreibung: 2020/2021-Zahl als "seit Pandemiebeginn" ausgegeben; 98 % statt korrekt 75 % unhinterfragt übernommen). Ein Fund darf **nur dann** automatisch als `PendingItem` vorgeschlagen werden, wenn:

1. **Quellentyp-Hierarchie eingehalten**: amtliche/gesetzliche Quelle (RKI, BMAS, gesetze-im-internet.de) oder peer-reviewed Publikation/AWMF-Leitlinie > systematischer Review/Metaanalyse > Fachgesellschafts-Statement > Einzelstudie (mit Stichprobengröße/Methodik explizit im Fund vermerkt, siehe `quellen.md`-Vorbild bei Charlton et al./Maffitt et al.) > Preprint (nur mit explizitem "Preprint, nicht begutachtet"-Vermerk) — News/Blogs/Foren werden **nicht** automatisch übernommen, höchstens als Hinweis "Presseartikel gefunden, Primärquelle prüfen".
2. **Zwei-Quellen-Pflicht bei Zahlenangaben**: Eine konkrete Statistik (Fallzahl, Prozentsatz, Prävalenz) wird nur vorgeschlagen, wenn sie in mindestens **zwei unabhängigen** Fundstellen übereinstimmend auftaucht, oder explizit als "nur eine Quelle, ungeprüft" markiert wird — genau die Verifikation, die bei "98 % vs. 75 %" in dieser Session nachträglich per Hand nötig war, soll hier vorab automatisiert erzwungen werden.
3. **Geltungszeitraum explizit**: Jede übernommene Zahl muss mit ihrem tatsächlichen Bezugszeitraum aus der Quelle stehen (z. B. "2020/2021", nicht stillschweigend als "aktuell" oder "seit Pandemiebeginn" verallgemeinert) — verhindert exakt den Fehler, der in dieser Session bei der Landingpage-Zahl (Fußnote 5) auftrat.
4. **Kein Ersetzen, nur Ergänzen**: Der Kriterienfilter darf niemals eine bestehende KB-Aussage automatisch überschreiben, nur einen neuen `PendingItem`-Vorschlag erzeugen ("möglicher Widerspruch zu `lib/knowledge/postcovid-mecfs.md`, Zeile X — bitte prüfen"). Auflösung von Widersprüchen bleibt Menschensache.
5. **LLM-Rolle bleibt Klassifikation/Zusammenfassung, nie Bewertung als "wahr"**: Analog zum bestehenden `updateSummary.ts`-Prompt — das Modell fasst zusammen und ordnet nach obiger Hierarchie ein, entscheidet aber nicht "das stimmt jetzt". Diese Entscheidung bleibt beim Menschen in der Freigabe.

## Kritischer Punkt: fehlendes zweites Speicher-Level (direkte Antwort auf "wie werden neue Infos gespeichert")

Aktuell gibt es nur **eine** Stufe für freigegebene Updates: `AddendumItem` in Redis, als wachsende Textliste, die bei **jedem** Chat-/Doc-Request neu an den System-Prompt angehängt wird (`getApprovedAddendumText()`) — unformatiert, ungecacht (kostet bei jedem Request erneut Tokens) und ohne erkennbare Obergrenze im aktuellen Code. Das ist für gelegentliche, kleine Funde tragbar, skaliert aber nicht: Je mehr über Monate freigegeben wird, desto teurer und unübersichtlicher wird jeder einzelne Request, und die Inhalte sind nie im eigentlichen, git-versionierten, redaktionell geprüften `lib/knowledge/*.md`-Bestand angekommen, der die eigentliche Zitierdisziplin des Projekts trägt.

**Vorschlag — zwei Stufen statt einer**:
- **Stufe 1 (bestehend, unverändert)**: Redis-Addendum — schnell, für frische, noch nicht redaktionell eingeordnete Funde, automatisch in jedem Request sichtbar.
- **Stufe 2 (neu)**: Regelmäßige "Graduierung" — in größeren Abständen (z. B. quartalsweise, oder manuell auf Zuruf) sichtet ein Mensch die angesammelten Redis-Addendum-Einträge und entscheidet, welche in eine echte `lib/knowledge/*.md`-Datei überführt werden (git-committet, wie die BG-Pflichten-/Standardbrief-Ergänzungen in dieser Session) — danach aus der Redis-Liste entfernt. Damit bleibt Stufe 1 klein und güns­tig, und dauerhaft relevante Erkenntnisse landen dort, wo sie mit dem Rest der Wissensbasis (`quellen.md`, Zitierkonventionen) konsistent geprüft werden, statt für immer als loser Anhängsel-Text zu existieren.

## Kritischer Punkt: Kosten

Drei neue Kostenquellen, alle **pro Cron-Lauf**, nicht pro Nutzeranfrage — anders als Tier 2 (Chat), aber trotzdem echtes Geld:
- Websuche selbst (je nach Anbieter/Kontingent).
- LLM-Bewertung gegen die Kriterienliste (Schritt "erfüllt Quellentyp-Hierarchie? Zwei-Quellen-Pflicht erfüllt?") — ein zusätzlicher LLM-Call pro Kandidat-Fund, zusätzlich zum bestehenden Zusammenfassungs-Call.
- Wachsendes Addendum erhöht (bis zur Graduierung, siehe oben) die Tokenkosten **jedes einzelnen** Chat-/Doc-Requests, weil dieser Block laut Code-Kommentar bewusst außerhalb der gecachten Kern-System-Prompt-Zeile liegt.

Empfehlung: monatlicher statt wöchentlicher Rhythmus für Signalquelle B (anders als der bestehende wöchentliche Hash-Check, der nahezu kostenlos ist), plus ein Tagesbudget-Alarm — deckt sich mit dem bereits in Phase 7 und im Effizienzplan diskutierten Kostenkontroll-Bedarf, hier nur auf einen weiteren Kostenblock ausgeweitet statt neu erfunden.

## Kritischer Punkt: kein Autonomie-Sprung

Nichts in diesem Plan ändert die Grundregel der bestehenden Pipeline: **kein automatischer Merge in die Wissensbasis**, in keiner Stufe. Sowohl neue Signalquellen (A, B) als auch die Graduierung (Stufe 2) laufen über dieselbe menschliche Freigabe wie heute schon. Das ist nicht nur Vorsicht um der Vorsicht willen, sondern deckt sich mit der RDG-Sensibilität, die schon in Phase 7 (Disclaimer-Verankerung) benannt wurde — bei einer Wissensbasis, die GdB/MdE-Einschätzungen mit Rechtswirkung für Betroffene mitträgt, ist automatisiertes Selbstlernen ohne Mensch in der Schleife kein vertretbares Ziel, unabhängig von der Qualität der Kriterien.

## Phasenplan (Entwurf)

- **8a — Usage-Gap-Signal**: Erkennung "KB deckt Frage nicht ab" in `lib/chat.ts`/`lib/doc.ts` ergänzen, anonymisiertes Themen-Signal statt Rohtext, neuer `PendingItem`-Typ `usage-gap` in `lib/reviewQueue.ts`. Kein neuer Cron nötig, läuft inline im bestehenden Request.
- **8b — Kriterienfilter als eigenständige Funktion**: `lib/updateSummary.ts` um eine zweite Prompt-Stufe erweitern (Kriterien-Check aus obiger Liste, strukturierte Ausgabe statt Fließtext, damit sich "erfüllt/erfüllt nicht" automatisiert auswerten lässt), unabhängig von Signalquelle A/B nutzbar.
- **8c — Aktive Websuche (Signalquelle B)**: Neuer, monatlicher Cron-Job, feste Themenliste aus `quellen.md`, Treffer durch 8b filtern, nur bestandene Kandidaten als `PendingItem`.
- **8d — Graduierung (Speicher-Stufe 2)**: Werkzeug/Prozess (zunächst evtl. nur ein dokumentierter manueller Ablauf, kein neuer Code) zum periodischen Sichten des Redis-Addendums und Überführen einzelner Einträge in `lib/knowledge/*.md` per normalem, geprüftem Commit.
- **8e — Kostenkontrolle scharf schalten**: Tagesbudget-Alarm für die neuen LLM-/Websuche-Kosten, bevor 8c live geschaltet wird — nicht danach.

## Offene Entscheidungen vor dem Start (von Florian zu klären)

- [ ] Themenliste für Signalquelle B — welche Suchanfragen konkret, wie oft überarbeitet
- [ ] Websuche-Anbieter/Kontingent für den Cron-Kontext (anders als eine interaktive Session — hier läuft es unbeaufsichtigt, serverseitig)
- [ ] Rhythmus Graduierung (Stufe 2) — quartalsweise fix, oder auf Zuruf, sobald das Addendum eine bestimmte Größe erreicht
- [ ] Ob das `usage-gap`-Signal client- oder serverseitig erkannt wird (Datenschutz-Abwägung: je näher am Server, desto eher ließe sich versehentlich mehr als nur das abstrahierte Thema mitschicken — bewusst vermeiden)
- [ ] Tagesbudget-Schwelle für die neuen Kosten (siehe Phase 7/Effizienzplan als Vorbild)
