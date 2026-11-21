import { sheetReady } from "@/lib/sheet";
import { storeKind } from "@/lib/measure";

export const dynamic = "force-dynamic";

/* Health check for uptime monitors: reports whether the sheet URL and signing key are both configured, never their values,
   and which store measurement requests use (upstash, memory or none), never its URL or token. */
export async function GET() {
  return Response.json(
    { ok: true, sheetConfigured: sheetReady(), measureStore: storeKind(), time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
