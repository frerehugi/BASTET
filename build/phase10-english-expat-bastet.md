# Phase 10: Englische BASTET-Variante für Expats in Deutschland

Planungsstand nach ausführlicher Diskussion (Oktober 2026) — reine Architektur-/Strategieentscheidungen, noch keine Umsetzung. Dieses Dokument hält fest, was entschieden wurde, warum, und was noch offen ist.

## 1. Positionierung

**Zielgruppe**: Englischsprachige Expats in Deutschland, die KI-Unterstützung im Umgang mit deutscher Bürokratie/Behörden brauchen — nicht (nur) deutschsprachige Post-COVID/ME-CFS-Betroffene wie der bestehende deutsche Arm.

**Strategischer Rahmen**: BASTET ist das erste Produkt in einer größer gedachten Linie ("klar umrissener Fokus, klare Zielgruppe") — Post-COVID/ME-CFS-Begutachtung ist der erste, bereits ausgereifte Anwendungsfall dieser Linie, nicht zwangsläufig der einzige langfristig. Diese Phase betrifft ausschließlich die englische BASTET-Variante selbst, nicht die größere Linie.

**Zwei komplett getrennte Produkte** (bewusst nicht vermischen — siehe Diskussion zu "wir bauen 2 Produkte"):

| | Produkt 1: x402-Bot | Produkt 2: Telegram-Kanal (+ mittelfristig WhatsApp, Website) |
|---|---|---|
| Käufer | KI-Agenten mit eigener Wallet | Menschen, nicht-technisch |
| Zahlung | x402, 0,1 USAT pro Call | Kreditkarte/PayPal/Apple Pay/Google Pay über normalen Zahlungsdienstleister |
| On-Chain/Hackathon-attributierbar | Ja | Nein — bewusst reine Reichweite, kein On-Chain-Anspruch |
| Wo Zahlung passiert | Direkt am Endpunkt (HTTP 402) | Eigene Checkout-Seite außerhalb Telegram |
| Wo Nutzung passiert | Agent ruft Endpunkt selbst auf | Telegram-Bot (mittelfristig auch WhatsApp/Website) nach Code-Einlösung |

## 2. Produkt 1: x402-Bot-Rail

- Preis: 0,1 USAT pro Call — kalkuliert gegen ca. 0,014 $ tatsächliche Kosten (Sonnet-5-Pricing, Prompt-Caching), ca. 86 % Marge.
- Celo ist das erste Netzwerk mit nativem x402-Support für USAT (USD-gedeckter Stablecoin, Anchorage/Tether).
- **Hackathon-Fit**: "Agents on Open Rails" (Celo), Submission-Fenster 2026-10-06 bis 2026-11-09, Kickoff-Call 06.10. 8 Uhr ET.
  - Track 2b "Stable Agents: Open Corridors" (1.000 $, USAT) — direkter Fit, "settle real USAT payments".
  - Track 3 "Build with buy" (1.000 $) — Celos eigener x402-Marktplatz, auf dem Agenten autonom für Compute/Daten/Browserzugriff zahlen. Möglicher Zusatz-Track, falls BASTETs x402-Endpunkt dort als Ressource gelistet wird ("demand it creates for buy") — **noch nicht recherchiert, offener Punkt**.
- Architektur: eigener, von Produkt 2 komplett unabhängiger HTTP-402-geschützter Endpunkt. Kein Telegram-, kein WhatsApp-Bezug.

## 3. Produkt 2: Telegram-Kanal (Kern) + mittelfristig WhatsApp, Website

### 3.1 Warum nicht der bestehende deutsche Telegram-Kanal

Der bestehende deutsche Bot hat aktuell **0 Nutzer** (siehe `/stats`) — nicht, weil Telegram als Kanal nicht funktioniert, sondern weil er nie beworben wurde (die deutsche Zielgruppe findet BASTET über die Website, nicht über Telegram). Für die englische Variante ist die Ausgangslage anders: Verteilung läuft nicht über organische Entdeckung, sondern wird von der Zahlungsseite aus erzwungen (Checkout-Seite → Deep-Link direkt in den Bot). Deshalb: **neuer, eigener englischer Bot** (z. B. `@BastetEnglishBot`), nicht der bestehende deutsche Bot mit Sprachumschaltung.

### 3.2 Zahlungsweg — Checkout-Seite, nicht Telegram-eigenes Payment

**Telegram Bot Developer ToS (§ 6.2, verifiziert am Originaltext)**: digitale Güter/Dienstleistungen müssen laut Telegram grundsätzlich exklusiv über Telegram Stars abgewickelt werden — Drittanbieter-Zahlungsdienste sind für TPA-interne Transaktionen untersagt. Telegram bindet diese Regel aber explizit an Apples/Googles eigene IAP-Definition ("goods and services that must be sold via in-app purchases"). Apples eigene Regel kennt die etablierte "Reader-App"-Ausnahme: Apps, die nichts im App selbst verkaufen (kein Preis, kein Kauf-Button, kein Kauf-Flow) und nur bereits woanders gekauften Zugang ausliefern, lösen keine IAP-Pflicht aus (Netflix/Spotify/Kindle-Muster).

**Entscheidung**: Zahlung läuft vollständig außerhalb Telegrams, auf einer eigenen Checkout-Seite. Der Bot selbst zeigt nirgends einen Preis, keinen Kauf-Button, keinen Zahl-Flow — er nimmt ausschließlich einen bereits ausgestellten Einlöse-Code entgegen. Das entspricht strukturell dem Reader-App-Muster. **Kein hundertprozentig garantiert sicherer Befund** — Telegrams Durchsetzungspraxis war laut Presseberichten teils breiter als der Wortlaut nahelegt. Durchsetzung läuft über Hinweis-und-Nachbesserung (nicht sofortige Sperrung), das Risiko ist also real, aber nicht existenzbedrohend-abrupt. Vor dem Go-Live der Bot-Texte noch einmal gegenprüfen.

Verworfene Alternativen für den Zahlungsweg:
- **Telegram Stars**: Verworfen — ca. 30 % Apple/Google-IAP-Abzug bei mobilem Kauf, 21 Tage Mindesthaltefrist vor Auszahlung, zusätzliches Kursrisiko auf dem Zwischenschritt über TON/GRAM (ca. -48 % in den letzten 12 Monaten, mehrere Prozent Wochenschwankung). In Summe deutlich schlechter als eine normale Kartenabwicklung (~3 % Gebühr, kein Lock-up).
- **Direkte On-Chain-MiniPay-Zahlung auf der Checkout-Seite** (WalletConnect): Verworfen als Teil von Produkt 2 — das würde Produkt 2 mit dem On-Chain-/Hackathon-Attribution-Ziel von Produkt 1 vermischen, das wir bewusst getrennt halten. "Pay with MiniPay" auf der Checkout-Seite meint nur die MiniPay-Visa-Karte über Apple/Google Pay — eine normale Kartenzahlung, kein eigener Rail.
- **APIS-Button ("Buy BASTET Code" in der APIS-App)**: Verworfen als primärer Weg — `apis.osirisapp.xyz` hat selbst noch keine Nutzer:innen, würde also kein Verteilungsproblem lösen. Die zugrundeliegende Idee (On-Chain-Zahlung autorisieren → Code → Telegram) lebt in der allgemeinen Checkout-Seite weiter, nur nicht an APIS gebunden.

**Finale Entscheidung**: eigene Checkout-Seite (Arbeitstitel `pay.bastet-covid.org`), Tier-Auswahl, Zahlung per Kreditkarte/PayPal/Apple Pay/Google Pay über einen Standard-Zahlungsdienstleister (Stripe o. ä. — unterstützt PayPal direkt in Checkout, keine separate Integration nötig). Nach Zahlungsbestätigung: Einmal-Code wird serverseitig erzeugt und in Redis abgelegt, Erfolgsseite zeigt sowohl den Code als auch einen `t.me/BastetEnglishBot?start=<code>`-Deep-Link zur sofortigen Einlösung (manuelles Einfügen als Fallback für Desktop/Web-Nutzung).

### 3.3 Admin-Befehle — bereits gelöst

`isAdminChat()` (`lib/adminCommands.ts:31`) prüft die eingehende `chat_id` gegen eine einzelne konfigurierte `TELEGRAM_ADMIN_CHAT_ID` — striktes Allowlisting, bereits produktiv bewährt beim deutschen Bot. Für den neuen englischen Bot: gleiche `chat_id` (Telegrams private-Chat-`chat.id` ist je Nutzer:in über alle Bots hinweg identisch), eigene frische `TELEGRAM_WEBHOOK_SECRET`. Admin-Pfad bleibt vollständig getrennt von Interview-/Einlöse-Logik — keine neue Angriffsfläche durch zahlende Kund:innen.

### 3.4 Mittelfristig: WhatsApp, Website

Gleicher Checkout-/Gutschein-Mechanismus, zusätzliche Auslieferungskanäle. Noch nicht im Detail geplant — WhatsApp-Business-API-Verifizierung (Testmodus sofort nutzbar, echte Produktionsnummer erfordert Geschäftsverifizierung, siehe `build/hackathon-listing-plan.md` Abschnitt 5) und eine reine Web-Chat-Variante (die deutsche Web-Oberfläche existiert bereits als Vorbild) sind die naheliegenden nächsten Kanäle, sobald der Telegram-Kanal steht.

## 4. Inhaltliche Anforderungen an die englische Variante

- **Sprache**: relativ einfaches, aber sauberes Englisch — nicht literarisch, aber korrekt. Zielgruppe ist oft selbst mit Brain Fog UND einer fremden Bürokratie konfrontiert.
- **Ton**: ruhig, wertschätzend, verständnisvoll — gleiche Grundhaltung wie der deutsche Prompt ("direkt und warm, niemals bürokratisch-kalt"), nur für eine Zielgruppe kalibriert, die zusätzlich mit einem fremden Verwaltungssystem zurechtkommen muss.
- **Behördenbegriffe**: durchgängig englischer Begriff mit deutschem Original in Klammern direkt dahinter (z. B. "Degree of Disability (Grad der Behinderung, GdB)", "Severely disabled person's ID (Schwerbehindertenausweis)"). Begründung: die Person braucht den deutschen Begriff, sobald sie tatsächlich mit einer deutschen Behörde, einem deutschen Formular oder einer deutschsprachigen Sachbearbeitung zu tun hat.
- **Wissensbasis bleibt Deutsch**: keine Übersetzung der kuratierten Wissensbasis nötig — Claude liest die deutschen Quellen und antwortet auf Englisch; das ist technisch unproblematisch und sogar vorteilhaft (Primärquellen bleiben unverändert/unverfälscht zitierfähig).

### 4.1 Brief-Erstellung: nur BG und Sozialamt (Bürgerbüro bewusst ausgeschlossen)

Bürgerbüro wurde explizit gestrichen — das betrifft Anmeldung/Ausweisdokumente, nicht Gesundheits-/Behinderungsthemen, und folgt nicht natürlich aus den Daten, die BASTETs eigenes Interview erhebt.

**Bereits vorhandene, wiederverwendbare Basis**: `lib/bgwLetter.ts` + `standardbrief-bgw.md` — rein clientseitige, datenschutzkonforme (Name/Adresse/Datum verlassen nie den Browser) Brieferzeugung. Extrahiert 2-3 Symptom-Stichworte aus der Auswertung (inkl. Verneinungserkennung, z. B. "Kein PEM" wird korrekt ausgeschlossen), setzt einen vollständigen deutschen Geschäftsbrief zusammen (Absender, Empfänger, Datumszeile, Betreff, Textkörper mit Rechtsgrundlage, Grußformel), liefert einen Versand-Hinweis (Einschreiben/DGUV-Serviceportal/E-Mail).

- **BG-Brief**: funktioniert bereits (feste bundesweite BGW-Adresse) — braucht nur eine englischsprachige UI-Hülle (Labels, Erklärtext), der Briefinhalt selbst bleibt zwingend Deutsch (geht an eine deutsche Behörde).
- **Sozialamt-Brief**: neue Vorlage nötig. Wichtiger Unterschied zu BG: **Sozialämter sind kommunal** — es gibt keine einzelne feste Adresse wie bei der BGW. Einfachste Lösung: Empfängeradresse wird wie die Absenderadresse von der Person selbst eingegeben (kein Postleitzahl-Lookup o. Ä. — das wäre zusätzlicher, hier nicht nötiger Scope).
- Beide: kopierbarer deutscher Text + Adresszeile, gleiches No-Storage-Prinzip wie beim bestehenden BG-Brief.

## 5. Offene Punkte

1. **"buy"-Marktplatz (Celo, Track 3)**: technische Anforderungen noch nicht recherchiert — klären, ob eine Listung dort zusätzlich zu Track 2b sinnvoll/machbar ist.
2. **Preis-Tiers für Produkt 2**: noch nicht final festgelegt. Frühere Circa-Hausnummer (~9,99 $-Bereich) stammt aus der Zeit, als nur eine einmalige GdB/MdE-Auswertung im Fokus stand — durch die Erweiterung auf eine allgemeinere Bürokratie-Begleitung (inkl. Briefgenerierung) ggf. andere Nutzungsfrequenz/Preislogik nötig.
3. **Sozialamt-Briefvorlage**: Inhalt/Rechtsgrundlage noch nicht ausgearbeitet (anders als der BG-Brief, der auf §§ 60 ff. SGB I / § 20 SGB X aufbaut) — eigene Recherche nötig, welcher Anlass/welche Rechtsgrundlage für ein Sozialamt-Schreiben im BASTET-Kontext (GdB-gestützte Anträge, z. B. Mehrbedarf/Eingliederungshilfe) passend ist.
4. **Checkout-Seite**: Stripe vs. Alternative, genaue Tier-Struktur, Domain/Hosting — Implementierungsdetails noch offen.
5. **WhatsApp/Website-Kanäle**: nur als mittelfristiges Ziel benannt, keine konkrete Umsetzungsplanung bisher.
