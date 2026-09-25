# Phase 9 — BASTET 2.0: Self als Gatekeeper für Tier 2/Doc-Arm, Telegram auf Tier 1 reduziert

**Status**: Plan, keine Umsetzung. Entstanden aus mehreren Planungsrunden (Branch
`claude/bastet-efficiency-analysis-b2elx8`) nach der Kostenanalyse in
`build/effizienz-plan.md` und der öffentlichen Live-Schaltung am 24.09.2026.
Dieses Dokument fasst die bisherigen Entscheidungen noch einmal zusammen,
denkt sie zu Ende — bewusst aus zwei Blickwinkeln (Patient:in, Ärzt:in) — und
macht die Tier-1-Qualität explizit zu einem eigenständigen, gleichrangigen
Arbeitsstrang statt eines Nebenprodukts.

## Ausgangslage — warum jetzt

Seit dem öffentlichen Launch ist die Reichweite spürbar gestiegen (siehe
Konsolen-Screenshots, Kostenanalyse-Sitzung). Eine vollständige Tier-2-Analyse
kostet aktuell real ca. 0,50–2 $ (Anthropic-API, nach dem Cache-Fix aus
`build/effizienz-plan.md`). Das bestehende Anthropic-Ausgabenlimit bleibt das
kurzfristige Sicherheitsnetz (bewusste Entscheidung: "wir lassen es laufen und
sehen dann") — Phase 9 ist die strukturelle Antwort darauf, nicht ein Ersatz
für diese Entscheidung.

Zusätzlich schon länger sichtbar (siehe Usage-Zahlen der letzten Sitzungen):
eine spürbare Lücke zwischen gestarteten und abgeschlossenen Tier-2-Sitzungen.
Genaue aktuelle Quote bitte über `/stats` (Telegram-Admin-Kanal) prüfen statt
eine ältere Zahl aus dieser Planungsrunde fortzuschreiben — der Trend war
aber eindeutig genug, um Sybil-Resistenz als echtes Kostenthema zu behandeln,
nicht nur als Nice-to-have.

## Bereits getroffene Architekturentscheidungen (aus vorherigen Planungsrunden)

Diese Punkte gelten als gesetzt, sofern unten nicht ausdrücklich als offene
Frage markiert:

1. **Self Protocol als Gatekeeper für Tier 2 UND den Doc-Arm** — beide laufen
   über echte Anthropic-API-Calls und bekommen dieselbe
   Verifizierungs-/Cooldown-Schicht vorgeschaltet. Telegram bleibt außen vor
   (siehe Punkt 5).
2. **Universal-Link-/Deeplink-Flow statt erzwungenem QR-Code**
   (`getUniversalLink()` + `deeplinkCallback` aus `@selfxyz/core`) — löst
   konkret den Fall "Nutzer:in hat nur ein Handy und keine Möglichkeit, einen
   QR-Code zu scannen". Die `@selfxyz/qrcode`-Frontend-Komponente schaltet
   selbstständig zwischen QR (Desktop) und Tap-Button (Mobile) um — keine
   eigene Geräteerkennung nötig. Quellen: [docs.self.xyz/use-self/use-deeplinking](https://docs.self.xyz/use-self/use-deeplinking),
   [selfxyz/self-discord-verification MOBILE_SUPPORT.md](https://github.com/selfxyz/self-discord-verification/blob/main/MOBILE_SUPPORT.md).
3. **Keine eigene Subdomain** (`self.bastet-covid.org` verworfen) — stattdessen
   eine Route auf der jeweils bestehenden Domain (z. B.
   `bastet-covid.org/verifizieren`, `doc.bastet-covid.org/verifizieren`).
   Grund: gleicher Origin wie der Rest der App → kein Cookie-/Session-Bruch,
   `deeplinkCallback` springt zurück in dieselbe laufende Sitzung. Passt in
   dieselbe Middleware-Umschreibung, die es für den Doc-Arm heute schon gibt
   (`middleware.ts`).
4. **Rate-Limit-Modell**: eine Self-Verifizierung (über den Nullifier) →
   Redis-Cooldown, gegated auf **abgeschlossene** Sitzungen (nicht
   gestartete), **gleitendes** 1-Stunden-Fenster. Bewusst akzeptierte Lücke:
   verhindert nicht mehrere abgebrochene, nicht abgeschlossene Versuche
   innerhalb der Stunde ("das Risiko gehen wir bewusst ein, bis wir die
   Besonderheiten der Community besser kennen").
5. **Telegram-Arm auf Tier 1 reduziert**: kein LLM-Q&A mehr über Telegram,
   stattdessen nach der regelbasierten Kurzauswertung ein fester Hinweis auf
   bastet-covid.org für die Detailanalyse. Praktischer Nebeneffekt: Self
   basiert auf QR/Deeplink zu einer eigenen App — das lässt sich in einem
   Telegram-Chat kaum sauber einbetten, die Reduktion macht eine
   Self-Integration dort von vornherein überflüssig.
6. **Admin-Befehle im Admin-Kanal bleiben unverändert** (`/stats` & Co.,
   `lib/adminCommands.ts`) — unabhängig vom Nutzer-Flow.
7. Ein Mockup der Gate-/Erfolgs-Screens existiert bereits (Design-Canvas,
   zwei Zustände, BASTET-Optik) — reiner visueller Entwurf, keine Code-Anbindung.

## Perspektive: Patient:in / Nutzer:in

BASTET richtet sich an eine Zielgruppe, für die PEM (post-exertionelle
Malaise) und kognitive Erschöpfung ("Brain Fog") keine Randnotiz, sondern der
Kern der Erkrankung sind (siehe `lib/knowledge/postcovid-mecfs.md`). Jeder
zusätzliche Schritt im Flow ist für diese Nutzer:innen keine generische
UX-Reibung wie bei einer beliebigen Web-App, sondern ein echter, spürbarer
Aufwand. Das verändert, wie das Self-Gate gebaut werden muss, nicht ob es
gebaut wird:

- **Wirklich einmalig, nicht pro Sitzung.** Der Nullifier-basierte Cooldown
  (Punkt 4 oben) muss so persistiert werden, dass eine einmal erfolgreich
  verifizierte Person nicht bei jeder neuen Detailanalyse erneut durch den
  vollen Self-Flow muss — sonst wird aus einer einmaligen Hürde eine
  wiederkehrende.
- **Framing als fairer Tausch, nicht als Misstrauen.** Der Mockup-Text
  ("Eine vollständige Analyse kostet uns real 0,50–2 $ ...") muss so bleiben:
  transparent, nachvollziehbar, keine Bevormundung. Nutzer:innen, die krank
  und ohnehin oft genug mit Misstrauen ("ist doch nur Erschöpfung") von
  Behörden/Gutachter:innen konfrontiert sind, dürfen hier nicht erneut das
  Gefühl bekommen, sich rechtfertigen zu müssen.
- **Tier 1 bleibt der garantierte, reibungslose Boden** — dazu unten der
  eigene Abschnitt, das ist der wichtigste Punkt aus dieser Perspektive.

### Kritischer Punkt: Self setzt ein passfähiges Ausweisdokument voraus

Self Protocol basiert auf einem ePassport-/eID-ZK-Proof. Das schließt Personen
strukturell aus, die kein unterstütztes Dokument besitzen oder besitzen
können (u. a. bestimmte Gruppen ohne gültigen Reisepass, je nach
Herkunftsland unterschiedlich unterstützte Dokumente). Für ein
Gesundheits-Tool, das gerade für vulnerable, oft ohnehin marginalisierte
Gruppen gedacht ist, ist das ein echter Zugangsgerechtigkeits-Punkt, keine
Kleinigkeit. Zwei Konsequenzen, die dieser Plan festhält, statt sie zu
übergehen:
- Tier 1 muss für diese Gruppe die **einzige**, aber vollwertige Option
  bleiben — kein "Light-Modus", sondern eine ernstzunehmende Auswertung
  (siehe Tier-1-Abschnitt unten).
- Die Kommunikation beim Self-Gate sollte diesen Fall nicht verschweigen:
  ein klarer Satz in der Art "Ohne unterstütztes Ausweisdokument bleibt die
  kostenlose Ersteinschätzung weiterhin vollständig nutzbar" gehört in den
  Gate-Screen, nicht nur als versteckte Fallback-Logik.

## Perspektive: Ärzt:in (Doc-Arm)

Der Doc-Arm hat aktuell **keinerlei Zugriffsschutz** (kein Login, keine
Rate-Begrenzung, geprüft: kein Treffer für Auth/Login/Passwort im
`app/doc`-Code). Ihn hinter Self zu stellen ist also kein "zusätzlicher"
Schritt, sondern der **erste** Zugriffsschutz überhaupt für diesen Arm — das
ist ein größerer Sprung als beim Patient:innen-Tier-2, wo zumindest schon ein
Diagnose-Gate und ein zweistufiger Flow existieren.

Das wirft eine Frage auf, die dieser Plan bewusst offen lässt (siehe unten),
statt sie stillschweigend mitzuentscheiden: Ärzt:innen, die BASTET als
Arbeitswerkzeug für eine Begutachtung nutzen, könnten es befremdlich finden,
dafür ihre **persönliche, passgebundene Identität** über eine
Consumer-Verifizierungs-App nachweisen zu müssen — anders als bei einer
patientenseitigen Anti-Abuse-Maßnahme ist das Bedrohungsmodell hier
möglicherweise ein anderes (eher Scraping/automatisierte Massenzugriffe als
Mehrfachidentitäten einer einzelnen Person). Denkbare Alternativen für
später, nicht jetzt zu entscheiden: institutionelle Verifikation (Klinik-
/BG-E-Mail-Domain), Nachweis über die Ärztekammer-Nummer, oder ein
einfacheres Allowlist-/Zugangscode-Modell für wiederkehrende institutionelle
Nutzer:innen. Bis das geklärt ist, bleibt die ursprüngliche Entscheidung
("Self auch für den Doc-Arm") der Ausgangspunkt dieses Plans.

## Tier-1-Qualität — tragendes Fundament, nicht Nebenprodukt

Das ist der wichtigste Effekt, den das Self-Gate auf die Gesamtarchitektur
hat, auch wenn er nicht direkt mit Self zu tun hat: **Sobald Tier 2 echte
Reibung bekommt** (Self-Verifizierung, evtl. fehlendes unterstütztes
Dokument, schlicht Zeitmangel), wird Tier 1 für einen relevanten Teil der
Nutzer:innen nicht mehr "die kostenlose Vorstufe vor der eigentlichen
Analyse", sondern die **einzige** Auswertung, die sie je bekommen. Die
Qualitätsanforderung an Tier 1 muss sich also der an Tier 2 annähern, nicht
dahinter zurückbleiben, nur weil es "nur" regelbasiert ist.

### Stand heute (bereits umgesetzt, diese Planungsrunde)

- CCC-/IOM-Kriterien, GdB-Spanne mit Bell-Score-Vorrang vor der
  Arbeitsfähigkeit-/PEM-Erholungs-Näherung (Analogie VersMedV 18.4 i. V. m.
  3.7 bzw. 3.1.1), mehrere Erhöhungsfaktoren (Kognition, psychische
  Komorbidität, Schmerzschwere/-breite, PEM-Auslöseschwelle, objektive
  Tests), Bettlägerigkeits-Boden.
- MdE-Spanne (nicht mehr nur "einschlägig ja/nein"): eigene Krosswalk-Tabelle
  (Widder/Gaidzik, `lib/knowledge/neurologie-mde-guv-tabellen.md`) statt
  1:1-Übernahme der GdB-Spanne, kalibriert gegen eine konkrete
  Post-COVID-Entscheidung (SG Heilbronn, 12.12.2024, S 2 U 426/24).
- EMR-Kategorie aus selbstgeschätztem Leistungsvermögen (Stunden/Tag).
- Eine zusammengeführte Frage zu beruflichem Zusammenhang **und**
  BK-3101-Status (`lib/triage/questions.ts`), näher an dem, was Betroffene
  aus eigener Erfahrung tatsächlich wissen.
- Vollständiger Zitier-/Referenzen-Block, identisches Format wie Tier 2 —
  Tier 1 sieht für Betroffene nicht wie eine Notlösung aus.

### Offene, ehrlich benannte Lücken

- **Symptombreite ist schmaler als die Wissensbasis selbst.** Tier 1 deckt
  im Kern nur das "ME/CFS-Kernpaket" ab (Fatigue/PEM, kognitiv, Schmerz,
  Schlaf, autonom, psychisch). Domänen, für die
  `lib/knowledge/symptomliste-gdb-mde-abgleich.md` bereits eine eigene
  GdB-Kalibrierung dokumentiert (respiratorisch, kardiovaskulär/POTS
  jenseits der reinen Orthostase-Frage, endokrin/Diabetes,
  Geruchs-/Geschmacksverlust), fließen in `computeTriage()` bislang gar
  nicht ein. Wer vorwiegend unter einer dieser Zusatzdomänen leidet, bekommt
  in Tier 1 eine unvollständigere Einschätzung als jemand mit klassischer
  ME/CFS-Symptomatik — genau das darf mit steigendem Gewicht von Tier 1
  nicht so bleiben.
- **Keine Konsistenzprüfung der Angaben.** Widersprüchliche Kombinationen
  (z. B. "weitgehend bettlägerig" bei gleichzeitig "Arbeitsfähigkeit ≥6
  Std./Tag") werden aktuell nicht erkannt oder rückgefragt.
- **EMR-Frage ist rein hypothetisch** ("wie viele Stunden wären
  vorstellbar"), kein Abgleich gegen etwas Beobachtbares (z. B. tatsächliche
  Krankheitstage/AU-Zeiten der letzten 6 Monate) — eine zweite,
  objektivere Verankerung wäre denkbar.
- **Keine Heilungsbewährungs-/Prognose-Logik.** Tier 1 liefert nur eine
  statische Momentaufnahme, keine zeitlich befristete Einordnung, obwohl die
  Wissensbasis das für Tier 2 bereits kennt (`postcovid-mecfs.md`,
  Abschnitt 3/5).
- **Kein Tracking des Tier-1-Abschlusses selbst** (siehe frühere Sitzung):
  `incrementStarted`/`incrementCompleted` greifen aktuell erst ab dem ersten
  Tier-2-API-Call. Sobald Tier 1 für einen relevanten Anteil zur einzigen
  Auswertung wird, fehlt ohne diesen Zähler die Sicht darauf, wie viele
  Menschen das überhaupt betrifft.

### Leitsatz für diesen Plan

Tier-1-Härtung ist kein Punkt, der nach dem Self-Gate "auch noch" erledigt
wird, sondern sollte **vor oder parallel zu** der Self-Integration
angegangen werden — siehe Reihenfolge im Phasenplan unten.

## Phasenplan (Entwurf)

- **9a — Tier-1-Qualitätshärtung** (siehe oben; sollte 9b/9c zeitlich
  vorausgehen oder parallel laufen, nicht nachgelagert werden):
  Symptombreite gezielt erweitern (Kandidaten zuerst: respiratorisch,
  kardiovaskulär/POTS, Diabetes — alle drei schon in
  `symptomliste-gdb-mde-abgleich.md` kalibriert), einfache
  Konsistenzprüfung ergänzen, Tier-1-Abschluss-Tracking nachrüsten.
- **9b — Self-Integration Grundgerüst**: `@selfxyz/qrcode` +
  `@selfxyz/core` einbinden, Verifizierungs-Route auf bestehender Domain
  (kein Subdomain-Setup nötig), adaptive QR-/Deeplink-Komponente wie in den
  Architekturentscheidungen festgelegt.
- **9c — Redis-Cooldown-Gate**: Nullifier → Redis-Key nach demselben Muster
  wie `lib/userCount.ts`, gegated auf abgeschlossene Sitzungen, gleitendes
  1-Stunden-Fenster.
- **9d — Doc-Arm-Anbindung**: abhängig von der unten offenen Frage
  (persönliche vs. institutionelle Verifikation) — erst nach dieser
  Entscheidung konkretisieren.
- **9e — Telegram-Reduktion**: Tier-2-Pfad aus `app/api/telegram/route.ts`
  / `lib/telegramSession.ts` entfernen, feste Website-Verweis-Nachricht nach
  Tier-1-Abschluss, Admin-Befehle unverändert lassen.
- **9f — Rollout/Monitoring**: Abschlussquote und Kosten vor/nach dem
  Self-Gate vergleichen (jetzt messbar dank 9a-Tracking), bestehendes
  Anthropic-Ausgabenlimit bleibt zusätzlich als Sicherheitsnetz bestehen.

## Offene Entscheidungen vor dem Start (von Florian zu klären)

- [ ] Doc-Arm: persönliche Self-Verifizierung wie bei Patient:innen, oder
      institutioneller Nachweis (Klinik-Domain, Ärztekammer-Nummer,
      Zugangscode)?
- [ ] Reihenfolge 9a vs. 9b/9c — wirklich vorgezogen, oder parallel mit
      fester Deadline für 9a?
- [ ] Umfang von 9a — reicht die genannte Dreierliste
      (respiratorisch/kardiovaskulär/Diabetes) für den ersten Schritt, oder
      soll die Symptomliste direkt vollständig gegen `postcovid-symptomliste.md`
      abgeglichen werden?
- [ ] Self-App: Sprachunterstützung (Deutsch) und Barrierefreiheit für eine
      eher ältere/kognitiv beeinträchtigte Zielgruppe vorher selbst prüfen,
      bevor der Gate-Text darauf verweist
- [ ] Kommunikationstext für Nutzer:innen ohne unterstütztes
      Ausweisdokument — eigener Satz im Gate-Screen (siehe Mockup) oder nur
      stille Fallback-Logik?
