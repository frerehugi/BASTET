import { Hono } from "hono";
import { paymentMiddleware } from "@x402/hono";
import { runExpatConsult } from "@/lib/expatConsult";
import { resourceServer, buildRoutes, buildInfoPacket, CONSULT_PATH } from "@/lib/x402";

export const runtime = "nodejs";
// 150s wie alle anderen Arme (chat/doc/bg-help/telegram, siehe deren
// route.ts) - war hier bislang nur 60s, obwohl dieser Pfad VOR dem
// eigentlichen Claude-Call zusätzlich noch zwei Facilitator-Round-Trips
// (verify+settle) hat, also eher mehr statt weniger Zeit braucht. Bug real
// beobachtet: ein Testlauf wurde von Vercel nach 60s mit
// FUNCTION_INVOCATION_TIMEOUT (504) gekillt - die x402-Middleware settelt
// die Zahlung VOR dem Handler, das war also sehr wahrscheinlich eine
// bezahlte, aber unbeantwortete Anfrage.
export const maxDuration = 150;

// Next.js-Catch-all (app/api/x402/[[...route]]/route.ts) leitet die volle
// Request/Response (Fetch-API) an Hono weiter - app.fetch() hat exakt die
// Next.js-Routen-Handler-Signatur, daher kein zusätzlicher Vercel-Adapter
// nötig (hono/vercel ist ohnehin deprecated zugunsten von @hono/vercel).
const app = new Hono();

app.use(paymentMiddleware(buildRoutes(), resourceServer));

// Frei zugänglich (buildRoutes() schützt nur POST {CONSULT_PATH}, nicht
// GET) - agent-lesbares Infopaket (Preis, Leistungsumfang, Grenzen), damit
// ein aufrufender Agent das vor einer Kaufentscheidung an den
// Wallet-Besitzer weitergeben kann, siehe lib/x402.ts buildInfoPacket().
app.get(CONSULT_PATH, (c) => c.json(buildInfoPacket()));

app.post(CONSULT_PATH, async (c) => {
  let body: { question?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON." }, 400);
  }
  if (typeof body.question !== "string" || !body.question.trim()) {
    return c.json({ error: "`question` is required." }, 400);
  }
  if (body.question.length > 4000) {
    return c.json({ error: "`question` is too long (max 4000 characters)." }, 400);
  }

  try {
    const answer = await runExpatConsult(body.question);
    return c.json({ answer });
  } catch (error) {
    // Zahlung ist an dieser Stelle laut x402-Middleware-Ablauf bereits
    // verifiziert UND settled, bevor dieser Handler läuft (siehe Skill-Doku,
    // "What happens at runtime", Schritt 3-4) - ein Fehlschlag hier (z.B.
    // Anthropic-API down) bedeutet also: bereits bezahlt, aber keine
    // Antwort geliefert. Bei 4,99 USAT/Aufruf (siehe lib/x402.ts) ein bewusst
    // in Kauf genommenes, geringes Restrisiko (Standardverhalten der offiziellen
    // x402-Middleware, siehe dortige Warnung gegen eigenes Verify/Settle-
    // Handling) - kein eigener Workaround hier, um nicht wieder von der
    // Middleware abzuweichen.
    const message = error instanceof Error ? error.message : "Unknown error.";
    return c.json({ error: message }, 502);
  }
});

export const GET = (request: Request) => app.fetch(request);
export const POST = (request: Request) => app.fetch(request);
