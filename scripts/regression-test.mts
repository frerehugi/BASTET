// Regressionstest "Stufe 1" (siehe build/effizienz-plan.md Abschnitt 5):
// deterministische Struktur-Checks gegen die echten API-Routen, kein
// LLM-Judge. Prüft pro Testfall aus scripts/regression/fixtures.ts:
//   1. Alle drei Blöcke (GdB/MdE/EMR) sind vorhanden.
//   2. Kein API-Fehler (insbesondere keine max_tokens-Abschneidung -
//      lib/anthropic.ts wirft dafür bereits eine Exception, die die Route
//      als { error } mit Status 502 zurückgibt).
//   3. Referenz-Integrität: jede im Text zitierte [n] hat einen Eintrag im
//      REFERENZEN-Block, und umgekehrt (keine verwaisten Referenzen).
//   4. Kein interner Wissensbasis-Dateiname (*.md) im REFERENZEN-Block.
//
// Voraussetzungen zum Ausführen (macht ECHTE, kostenpflichtige API-Aufrufe -
// siehe build/effizienz-plan.md: nicht bei jedem Commit laufen lassen,
// sondern vor Releases/nächtlich):
//   1. Server mit gesetztem ANTHROPIC_API_KEY läuft (lokal: `npm run dev`,
//      oder BASTET_TEST_BASE_URL auf eine Preview-/Prod-URL zeigen lassen).
//   2. `npm run test:regression`
//
// Bewusst ohne neues Test-Framework: Node (>= 22) kann .ts-Dateien mit
// ESM-Imports nativ ausführen, `fetch` ist eingebaut - keine zusätzliche
// Abhängigkeit nötig für dieses schlanke Grundgerüst.

import type { ChatMessage } from "../lib/anthropic.ts";
import { splitReferences } from "../lib/format.ts";
import { FIXTURES, type ChatFixture, type DocFixture } from "./regression/fixtures.mts";

const BASE_URL = process.env.BASTET_TEST_BASE_URL ?? "http://localhost:3000";
const MAX_CHAT_TURNS = 6;
const FALLBACK_MESSAGE = "Bitte jetzt zur Auswertung übergehen, das reicht mir.";

interface ApiResult {
  text?: string;
  error?: string;
}

interface CheckResult {
  name: string;
  ok: boolean;
  detail?: string;
}

async function postJson(path: string, payload: unknown): Promise<ApiResult> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await response.json()) as { text?: string; error?: string };
  if (!response.ok || data.error) {
    return { error: data.error ?? `HTTP ${response.status}` };
  }
  return { text: data.text };
}

async function runChatFixture(fixture: ChatFixture): Promise<ApiResult & { turnsUsed: number }> {
  const messages: ChatMessage[] = [];
  const scripted = [...fixture.userTurns];
  let turnCount = 0;
  let lastText: string | undefined;

  while (turnCount < MAX_CHAT_TURNS) {
    const nextUser = scripted.shift() ?? FALLBACK_MESSAGE;
    messages.push({ role: "user", content: nextUser });

    const result = await postJson("/api/chat", {
      messages,
      diagnosisConfirmed: fixture.diagnosisConfirmed,
      turnCount,
    });
    turnCount += 1;

    if (result.error) return { error: result.error, turnsUsed: turnCount };
    lastText = result.text;
    messages.push({ role: "assistant", content: result.text ?? "" });

    if (result.text?.includes("REFERENZEN:")) {
      return { text: result.text, turnsUsed: turnCount };
    }
  }

  return {
    text: lastText,
    error: lastText ? undefined : "Keine Antwort erhalten",
    turnsUsed: turnCount,
  };
}

async function runDocFixture(fixture: DocFixture): Promise<ApiResult> {
  return postJson("/api/doc", { userInput: fixture.userInput });
}

function checkBlocksPresent(text: string): CheckResult {
  const required = ["── GdB", "── MdE", "── Erwerbsminderungsrente"];
  const missing = required.filter((marker) => !text.includes(marker));
  return {
    name: "Alle drei Blöcke (GdB/MdE/EMR) vorhanden",
    ok: missing.length === 0,
    detail: missing.length ? `Fehlend: ${missing.join(", ")}` : undefined,
  };
}

function checkReferenceIntegrity(text: string): CheckResult {
  const { refs } = splitReferences(text);
  if (!refs) {
    return { name: "Referenz-Integrität", ok: false, detail: "Kein REFERENZEN-Block gefunden" };
  }

  const marker = "REFERENZEN:";
  const bodyText = text.slice(0, text.indexOf(marker));
  const cited = new Set([...bodyText.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const defined = new Set(
    refs.map((r) => Number(r.match(/^\[(\d+)\]/)?.[1] ?? -1)).filter((n) => n >= 0)
  );

  const citedButUndefined = [...cited].filter((n) => !defined.has(n));
  const definedButUncited = [...defined].filter((n) => !cited.has(n));
  const ok = citedButUndefined.length === 0 && definedButUncited.length === 0;

  const details: string[] = [];
  if (citedButUndefined.length) details.push(`Zitiert ohne Definition: ${citedButUndefined.join(", ")}`);
  if (definedButUncited.length) details.push(`Definiert, aber nie zitiert: ${definedButUncited.join(", ")}`);

  return { name: "Referenz-Integrität ([n] <-> REFERENZEN-Block)", ok, detail: details.join("; ") || undefined };
}

function checkNoFilenameLeak(text: string): CheckResult {
  const marker = "REFERENZEN:";
  const idx = text.indexOf(marker);
  const refsBlock = idx === -1 ? "" : text.slice(idx);
  const leaked = /[a-z0-9][a-z0-9-]*\.md\b/gi.test(refsBlock);
  return { name: "Kein interner Dateiname (*.md) im REFERENZEN-Block", ok: !leaked };
}

async function main(): Promise<void> {
  let failures = 0;

  for (const fixture of FIXTURES) {
    console.log(`\n=== ${fixture.id} (${fixture.arm}) ===`);

    const result =
      fixture.arm === "chat"
        ? await runChatFixture(fixture)
        : await runDocFixture(fixture);

    if ("turnsUsed" in result) {
      console.log(`  Turns genutzt: ${result.turnsUsed}`);
    }

    if (result.error) {
      console.error(`  FEHLER beim API-Aufruf: ${result.error}`);
      failures += 1;
      continue;
    }

    if (!result.text) {
      console.error("  FEHLER: keine Antwort erhalten");
      failures += 1;
      continue;
    }

    const checks = [
      checkBlocksPresent(result.text),
      checkReferenceIntegrity(result.text),
      checkNoFilenameLeak(result.text),
    ];

    for (const check of checks) {
      const status = check.ok ? "OK  " : "FAIL";
      console.log(`  [${status}] ${check.name}${check.detail ? " — " + check.detail : ""}`);
      if (!check.ok) failures += 1;
    }
  }

  console.log(`\n${failures === 0 ? "Alle Checks bestanden." : `${failures} Check(s) fehlgeschlagen.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("Unerwarteter Fehler im Regressionstest:", error);
  process.exit(1);
});
