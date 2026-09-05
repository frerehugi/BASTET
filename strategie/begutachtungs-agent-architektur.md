# Architektur: Multi-LLM Begutachtungs-Agent (Post-COVID/ME-CFS-Schwerpunkt)

Arbeitstitel. Ziel: ein Agent, der (a) sich regelmäßig aktiv über Begutachtungspraxis und Sozialgerichtsurteile informiert und (b) Post-COVID-/ME-CFS-Patient:innen im Chat zu ihrer Begutachtung berät — nutzbar aus Claude, ChatGPT, Gemini und weiteren Clients. Klassischer Stack (kein Blockchain-Bezug); Celo-Anbindung als späterer optionaler Baustein vorgesehen, siehe Abschnitt 6.

## 1. Grundprinzip: ein Backend, drei Fronten

Die gesamte Logik (Wissen, Aktualisierung, Sicherheits-/Rechtsleitplanken) lebt in **einem** Backend. Claude/ChatGPT/Gemini sind austauschbare Zugangswege dazu — keine Logik wird pro Anbieter dupliziert.

```
                     ┌─────────────────────────┐
                     │   Wissensbasis (Store)   │
                     │  strukturiert, versioniert│
                     └───────────┬─────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                         │
┌───────▼────────┐   ┌───────────▼──────────┐   ┌──────────▼─────────┐
│ Update-Pipeline │   │   Core-API (Backend)  │   │  Human-Review-Queue │
│ (aktive Recherche│  │  RAG + Reasoning +    │   │ (Florian prüft      │
│  BSG/LSG/DGUV/  │──▶│  Leitplanken/Disclaimer│   │  wesentliche        │
│  AWMF)          │   └───────────┬──────────┘   │  Änderungen)         │
└─────────────────┘               │              └─────────────────────┘
                     ┌─────────────┼─────────────┐
                     │             │             │
              ┌──────▼───┐  ┌──────▼───┐  ┌──────▼───┐
              │MCP-Server│  │GPT Action│  │  Gemini  │
              │ (Claude) │  │(ChatGPT) │  │Extension │
              └──────────┘  └──────────┘  └──────────┘
```

## 2. Wissensbasis (Knowledge Store)

Erweiterung des bereits gebauten `de-begutachtung`-Skills um eine **versionierte, durchsuchbare** Form (der Skill selbst bleibt als statische Referenz für Claude-Sessions bestehen; der Store ist die dynamische, wachsende Quelle für den Agenten).

- **Struktur**: pro Wissenseinheit ein Datensatz mit `Thema`, `Rechtsgrundlage` (GdB/GdS/MdE), `Inhalt`, `Quelle+Link`, `Stand-Datum`, `Reviewstatus`.
- **Speicherung**: naheliegend, da du bereits mit Cloudflare arbeitest (OSIRIS-Keeper) — **Cloudflare D1** (SQL) für Metadaten + **Cloudflare Vectorize** für Embeddings/RAG-Suche. Alternative: Postgres + pgvector, falls du das lieber selbst hostest.
- **Kernbestand**: die vier Referenzdateien aus dem `de-begutachtung`-Skill als Startdaten, in Einzel-Chunks zerlegt und embedded.

## 3. Update-Pipeline — "regelmäßig aktiv informieren"

Ein Scheduled Worker (Cron, z. B. täglich oder wöchentlich — kein 5-Minuten-Takt wie der OSIRIS-Keeper nötig, da Urteile/Leitlinien selten wechseln).

**Quellen, die abgegriffen werden:**
| Quelle | Was | Zugriff |
|---|---|---|
| Bundessozialgericht (BSG) | neue Leitsatz-Entscheidungen zu MdE/GdB/GdS | `bsg.bund.de`, RSS/HTML-Scraping |
| sozialgerichtsbarkeit.de | LSG-Entscheidungen (auch Post-COVID-Fälle) | Suchindex, HTML-Scraping |
| DGUV | Rundschreiben, UV-Recht-Datenbank (BK 3101 etc.) | `dguv.de/uv-recht` |
| AWMF-Register | Leitlinien-Versionsänderungen (S1 Long/Post-COVID) | Register-API/Versionshistorie |
| REHADAT | VersMedV-Novellierungen | `rehadat-literatur.de` |

**Pipeline-Schritte:**
1. Fetch (regelmäßig, mit Diff gegen letzten bekannten Stand)
2. Wenn neu/geändert: Extraktion + Zusammenfassung durch ein LLM (Kernaussage, betroffene GdB/MdE-Werte, Datum, Quelllink)
3. **Human-Review-Queue statt Autopublish**: Neue/geänderte Einträge landen zunächst in einer Review-Warteschlange, nicht direkt in der patientenfacing Wissensbasis — gerade bei Rechtsprechung ist Fehlinterpretation riskant. Du (oder eine von dir benannte Fachperson) bestätigst, dann geht der Eintrag live und wird embedded.
4. Publish → Vectorize/D1 aktualisiert → ab sofort in RAG-Antworten verfügbar, mit Datumsstempel "Stand: ..." in jeder Antwort.

Das ist bewusst konservativer als der Handelsagent-Ansatz bei OSIRIS (dort vollautomatisch) — bei medizinisch-rechtlichen Inhalten mit Patientenkontakt ist ein Freigabeschritt der richtige Kompromiss zwischen Aktualität und Sorgfaltspflicht.

## 4. Core-API (Backend)

Eine schlanke API (z. B. Cloudflare Worker, wie bei APIS), die:
- Anfragen entgegennimmt (`POST /ask`)
- RAG-Suche gegen die Wissensbasis macht
- mit System-Prompt + Leitplanken (Abschnitt 5) an ein LLM übergibt
- die Antwort **mit Quellenangaben** zurückgibt

Diese eine API wird von allen drei Frontends angesprochen — MCP-Server, GPT Action und Gemini-Extension sind dann nur noch dünne Protokoll-Adapter:

- **MCP-Server** (Claude, Claude Code, jeder MCP-Client): Tools wie `such_begutachtungswissen`, `hole_neue_urteile`, `post_covid_beratung`. Analog zu deinem bestehenden `apis/backend`-Muster.
- **GPT Action** (ChatGPT/Custom GPT): OpenAPI-Schema, das dieselbe REST-API beschreibt.
- **Gemini Extension**: Function-Calling-Definition gegen dieselbe REST-API.

## 5. Patientenschutz- und Compliance-Schicht — der kritischste Teil

Zwei Risiken, die vor dem ersten Release geklärt sein sollten:

1. **Rechtsdienstleistungsgesetz (RDG)**: Konkrete, fallbezogene Rechtsberatung ("Legen Sie Widerspruch ein, weil...") ist in Deutschland registrierten Personen vorbehalten (Rechtsanwälte, Rentenberater). Der Agent sollte sich auf **allgemeine Information** beschränken (Was bedeutet GdB? Welche Kriterien gelten? Wo finde ich Unterstützung?) und bei konkreten Fallentscheidungen konsequent an Fachanwält:innen für Sozialrecht bzw. Sozialverbände (z. B. VdK, SoVD) verweisen. Das sollte fest im System-Prompt verankert sein, nicht optional.
2. **Zielgruppe ist vulnerabel**: ME/CFS/Post-COVID-Betroffene sind oft schwer erschöpft, teils isoliert, nicht selten frustriert von Ablehnungsbescheiden. Der Ton muss unterstützend, aber nicht false-hope-erzeugend sein; bei Anzeichen von Verzweiflung/Suizidalität greifen dieselben Fürsorgepflichten wie in jedem Claude-Chat (Krisenressourcen nennen, nicht einfach weiterberaten).
3. **Medizinisch keine Diagnose**: Der Agent stellt keine Diagnosen, sondern erläutert, wie eine bestehende Diagnose begutachtungsrechtlich eingeordnet wird.

Praktisch: fester Disclaimer-Baustein in jeder patientenfacing Antwort, identisch über alle drei Frontends (da eine Core-API).

## 6. Celo-Anbindung — später, optional

Bewusst aus dem MVP rausgehalten, aber architektonisch so vorbereitet, dass es sich anfügen lässt, ohne etwas umzubauen:

- **ERC-8004-Agent-Identität**: könnte später auf die Core-API aufgesetzt werden (wie bei APIS/OSIRIS), ohne die RAG-/Update-Logik zu berühren.
- **x402**: falls du den Zugang später monetarisieren willst (z. B. Pay-per-Query für Sozialrechtler:innen, die den Agenten in eigene Tools einbinden) — reine Zahlungsschicht vor der Core-API, kein Architektur-Umbau nötig.
- **Celo-Builders-Hackathon**: Da du dich noch nicht festgelegt hast — das Zeitfenster (bis 14.09.2026) ist knapp für dieses Projekt in voller Tiefe. Realistische Option wäre ein **reduzierter MVP** (Wissensbasis + Core-API + ein Frontend, z. B. nur MCP) als Hackathon-Submission, mit Rest als Post-Hackathon-Ausbau. Sag Bescheid, falls du das anpeilen willst, dann skizziere ich dir einen konkreten 10-Tage-Fahrplan.

## 7. Vorgeschlagene Bau-Reihenfolge (MVP zuerst)

1. Wissensbasis aus dem bestehenden `de-begutachtung`-Skill befüllen (Chunking + Embedding)
2. Core-API mit RAG + Disclaimer-Leitplanken (ohne Update-Pipeline, erstmal mit statischem Stand)
3. Ein Frontend zuerst — MCP-Server, da du dort die meiste Infrastruktur-Erfahrung hast (analog `apis/backend`)
4. Update-Pipeline (Scheduled Worker) nachziehen
5. GPT Action und Gemini-Extension als dünne Adapter auf dieselbe API
6. Celo-Layer bei Bedarf
