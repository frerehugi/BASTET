# BASTET bei "Agents at Work" listen + Telegram/WhatsApp — einfachster Weg

Zeitfenster: Hackathon läuft bis **14.09.2026**, heute ist der 04.09. — realistisch **~10 Tage**. Der Plan ist bewusst auf das Minimum zugeschnitten, das für ein gültiges, funktionierendes Listing reicht — nicht auf das technisch Elegante.

**Einordnung**: Der Hackathon ist wie ein **Audit**, kein Marketing-Event — der Prozess selbst (öffentliches Repo, on-chain überprüfbare Registrierung, verifizierbare Zahlungen) erzwingt externe technische Kontrolle. Ein System, das dem standhält, hat Vorrang vor einer polierten Submission.

## 0. Der eine Baustein, der alles andere trägt: ein echtes Backend

Der bisherige Prototyp ruft die Anthropic-API direkt aus dem React-Artefakt auf — das funktioniert nur innerhalb von Claude. Für Telegram, WhatsApp und x402 braucht es zwingend einen echten, öffentlich erreichbaren Server, der:
- die System-Prompt-Logik und Wissensbasis hält (aus dem Prototyp übernehmbar),
- von allen Kanälen gleichermaßen angesprochen wird (ein Endpunkt `POST /chat`),
- einen x402-geschützten Endpunkt anbietet (`POST /premium`, s. u.),
- die Telegram-Webhooks entgegennimmt.

**Einfachste Umsetzung**: ein Cloudflare Worker (du hast damit bereits Erfahrung aus OSIRIS/APIS) — ein einziges Projekt, drei Routen. Das ist der zeitkritischste Schritt, weil alles andere darauf aufbaut.

## 1. ERC-8004-Agent-Identität — minimal, in unter einer Stunde

Du brauchst nur eine neue Celo-Wallet und eine Handvoll CELO für Gas (ein paar Cent reichen).

```ts
import { createWalletClient, http, parseAbi } from "viem";
import { celo } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const account = privateKeyToAccount(process.env.AGENT_PRIVATE_KEY!);
const client = createWalletClient({ account, chain: celo, transport: http() });

// Metadata als data:-URI — spart das IPFS-Pinning, gilt als content-addressed
const metadata = {
  type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  name: "BASTET",
  description: "KI-gestützte Vorbegutachtung für Post-COVID/ME-CFS im deutschen Sozialrecht (GdB/MdE).",
  services: [
    { name: "web", endpoint: "https://co-bgutachtung.example.com" },
    { name: "MCP", endpoint: "https://co-bgutachtung.example.com/mcp" }
  ],
  supportedTrust: ["reputation"]
};
const agentURI = "data:application/json;base64," + Buffer.from(JSON.stringify(metadata)).toString("base64");

const txHash = await client.writeContract({
  address: IDENTITY_REGISTRY,
  abi: parseAbi(["function register(string) returns (uint256)"]),
  functionName: "register",
  args: [agentURI],
});
```

Danach die `agentId` (aus dem Event/Return-Wert der Transaktion, oder via `ownerOf`-Lookup auf 8004scan.io) notieren — die brauchst du für die Hackathon-Submission (`erc8004Url`, z. B. `https://www.8004scan.io/agents/celo/<id>`).

**Self Agent ID (Proof-of-Human) ist für dieses Hackathon explizit nicht zwingend** — laut Skill "hilfreich, aber nicht strikt erforderlich, wo Self nicht verfügbar ist". Für die knappe Zeit: **weglassen**, spart einen kompletten Schritt mit Passport-Scan.

## 2. x402-taugliche Wallet — dieselbe Wallet, ein zusätzlicher Endpunkt

Wichtig zu verstehen: "x402-tauglich" ist keine Wallet-Eigenschaft, die man einrichtet, sondern eine **Server-Fähigkeit** — dieselbe Wallet aus Schritt 1 kann als `payTo`-Adresse dienen, sobald der Server einen bezahlten Endpunkt anbietet.

Um das Kriterium einfach zu erfüllen, ohne das kostenlose Kernprodukt zu monetarisieren: **ein optionaler Zusatz-Endpunkt**, z. B. "erweiterte PDF-Zusammenfassung der Auswertung mit allen Referenzen" für 0,10 USDC. Das Patienten-Interview selbst bleibt kostenlos wie besprochen.

- Facilitator: `https://x402.celo.org` (gehostet, übernimmt Gas fürs Settlement — Käufer brauchen kein CELO)
- Vor dem Bauen **immer zuerst** `https://x402.celo.org/SKILL.md` abrufen (aktuellster Integrationscode) statt den Code hier direkt zu übernehmen — die API ändert sich.
- Token: USDC (`0xcebA9300f2b948710d2653dD7B07f33A8B32118C`, 6 Dezimalstellen). Preis als Objekt angeben, nicht als `"$0.01"`-String (typprüft, wirft aber zur Laufzeit).
- API-Key beim Facilitator holen: Wallet auf `x402.celo.org` verbinden, Nachricht signieren (kein Gas) → 500 Gratis-Credits auf Mainnet.

## 3. Bei Celo Builders registrieren

Mit dem `celo-builders`-Skill (bereits vorhanden):

1. `curl https://celobuilders.xyz/hackathons` → Slug für "Agents at Work" bestätigen
2. `curl https://celobuilders.xyz/hackathons/<slug>/submission-fields` → **zuerst prüfen**, welche Felder Pflicht sind (ändert sich pro Hackathon, nicht raten)
3. Google-Login-Flow starten (`/auth/google/start` → Link öffnen → Code zurückgeben → `/auth/google/claim`)
4. **Früh registrieren** (`PUT /submissions/me` mit Projektname + GitHub-URL) — das sichert den `attributionTag`, der für die x402-Leaderboard-Zuordnung gebraucht wird. Je früher, desto mehr Zeit zählt.
5. `agentWalletAddress` (aus Schritt 1) und `erc8004Url` in die `customFields` eintragen, sobald vorhanden.
6. **Öffentliches GitHub-Repo ist Pflicht** — der Cloudflare-Worker-Code muss dafür in ein `github.com/<owner>/<repo>` gepusht werden. Das ist der einzige Schritt, für den ich deine GitHub-Zugangsdaten bräuchte — entweder du pusht selbst (ich bereite den Code fertig vor), oder du gibst mir ein Repo, in das ich schreiben darf.
7. Jede x402-Transaktion muss den zugewiesenen `attributionTag` im Data-Suffix tragen (`toDataSuffix()` aus `@celo/attribution-tags`) — sonst zählt sie nicht fürs Leaderboard.
8. Erst final `POST /submissions/me/publish` senden, wenn du das Ergebnis freigegeben hast — bis dahin bleibt der Entwurf privat.

## 4. Telegram-Bot — der schnellste zusätzliche Kanal

Realistisch in ein bis zwei Stunden, weil kein Verifizierungsprozess nötig ist:

1. Mit **@BotFather** in Telegram chatten → `/newbot` → Name + Username vergeben → Token erhalten.
2. Webhook auf den Cloudflare Worker zeigen: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<dein-worker>/telegram`
3. Der Worker empfängt eingehende Nachrichten als POST, ruft dieselbe Chat-Logik wie das Web-Interface auf, sendet die Antwort über `https://api.telegram.org/bot<TOKEN>/sendMessage` zurück.
4. Zeitbudget-/Referenzen-Logik bleibt identisch — nur das Rendering ändert sich leicht (Telegram kennt kein `whiteSpace: pre-wrap`, aber Markdown-ähnliche Formatierung via `parse_mode: "MarkdownV2"`).
5. **Kein Speicher-Problem**: Telegram hat von Haus aus einen `chat_id`, über den sich der laufende Verlauf zuordnen lässt — die "keine Speicherung"-Regel bleibt bestehen, wenn der Worker den Verlauf nur im Request-Kontext hält und nichts persistiert (z. B. über signierte, im Client/Chat mitgeführte Historie statt serverseitigem Session-Store — für den Anfang reicht sogar "nur die letzten N Nachrichten aus dem Telegram-Chatverlauf per `getUpdates` erneut lesen").

## 5. WhatsApp — realistisch einordnen

Direkt machbar, aber mit einer echten Grenze, die ich nicht kleinreden will:

- **Sofort verfügbar, ohne Business-Verifizierung**: Meta gibt beim Anlegen einer WhatsApp-Cloud-API-App automatisch eine **Test-Rufnummer** plus temporäres Access Token — bis zu 5 selbst hinzugefügte Empfänger-Nummern können sofort testen, keine Firmenverifizierung nötig. **Für eine Hackathon-Demo reicht das völlig aus.**
- **Nicht in 10 Tagen machbar**: eine echte, öffentlich nutzbare Produktionsnummer für beliebige Patient:innen erfordert Meta-**Geschäftsverifizierung** (Firmenname, Adresse, Dokumente) — das dauert erfahrungsgemäß Tage bis über eine Woche und ist ein Bürokratie-, kein Technikproblem.
- **Empfehlung**: WhatsApp im Testmodus für die Hackathon-Demo/das Video mitnehmen (zeigt, dass der Kanal technisch steht), die öffentliche Freischaltung als "kommt nach dem Hackathon" kommunizieren, statt jetzt Zeit in die Verifizierungsbürokratie zu stecken.

## 6. Realistische Reihenfolge für die 10 Tage

1. **Tag 1–2**: Cloudflare Worker mit `/chat`-Endpoint (Kernlogik aus dem Prototyp übernehmen) — das Fundament für alles Weitere.
2. **Tag 2**: ERC-8004-Registrierung (Schritt 1) — unabhängig vom Rest, kann parallel laufen.
3. **Tag 3**: Celo-Builders-Frühregistrierung (Schritt 3, Punkte 1–4) — sichert den `attributionTag` so früh wie möglich.
4. **Tag 3–4**: x402-Endpunkt (Schritt 2) — kleinster Baustein, klar abgegrenzt.
5. **Tag 4–5**: Telegram-Bot (Schritt 4).
6. **Tag 5–6**: WhatsApp-Testmodus (Schritt 5) — nur für die Demo, nicht für Live-Betrieb.
7. **Tag 6–8**: GitHub-Repo öffentlich machen, Submission-Felder vollständig ausfüllen, Demo-Video.
8. **Tag 8–9**: Puffer für Nacharbeiten, dann `publish`.
9. **Tag 9–10**: Puffer.

## Was ich von dir brauche, um loszulegen
- Grünes Licht, den Cloudflare-Worker-Code jetzt zu schreiben (Schritt 0)
- Eine neue Wallet-Adresse (oder ich generiere eine, dann musst du sie mit ein paar Cent CELO befüllen)
- Zugriff auf ein GitHub-Repo (neu anlegen oder bestehendes freigeben), sobald der Code steht
