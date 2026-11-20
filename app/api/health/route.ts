import { sheetReady } from "@/lib/sheet";

export const dynamic = "force-dynamic";

/* Health check for uptime monitors: reports whether the sheet URL and signing key are both configured, never their values. */
export async function GET() {
  return Response.json(
    { ok: true, sheetConfigured: sheetReady(), time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
