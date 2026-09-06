import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { notifyAdminOfPendingItem } from "@/lib/adminCommands";
import { addPendingItem, getLastFingerprint, setLastFingerprint } from "@/lib/reviewQueue";
import { UPDATE_SOURCES } from "@/lib/updateSources";
import { summarizeSourceChange } from "@/lib/updateSummary";

export const runtime = "nodejs";
export const maxDuration = 60;

interface SourceRunResult {
  sourceId: string;
  status: "unchanged" | "changed" | "baseline" | "error";
  detail?: string;
}

export async function GET(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results: SourceRunResult[] = [];

  for (const source of UPDATE_SOURCES) {
    try {
      const previousFingerprint = await getLastFingerprint(source.id);
      const check = await source.check(previousFingerprint);

      if (previousFingerprint === null) {
        // Erster Lauf für diese Quelle: nur Baseline speichern, keine
        // Falschmeldung "alles hat sich geändert" beim allerersten Check.
        await setLastFingerprint(source.id, check.fingerprint);
        results.push({ sourceId: source.id, status: "baseline" });
        continue;
      }

      if (!check.changed) {
        results.push({ sourceId: source.id, status: "unchanged" });
        continue;
      }

      const summary = await summarizeSourceChange(source.label, check.rawContentForSummary, check.detailUrl);
      const item = {
        id: randomUUID(),
        sourceId: source.id,
        sourceLabel: source.label,
        sourceUrl: check.detailUrl,
        summary,
        detectedAt: Date.now(),
      };
      await addPendingItem(item);
      await setLastFingerprint(source.id, check.fingerprint);
      await notifyAdminOfPendingItem(item);
      results.push({ sourceId: source.id, status: "changed" });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unbekannter Fehler";
      console.error(`Update-Check fehlgeschlagen für ${source.id}:`, error);
      results.push({ sourceId: source.id, status: "error", detail });
    }
  }

  return NextResponse.json({ ok: true, results });
}
