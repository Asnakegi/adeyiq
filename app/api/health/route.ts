import { SHEET_URL } from "@/lib/sheet";

export const dynamic = "force-dynamic";

/* Health check for uptime monitors: reports whether required configuration is present, never its value. */
export async function GET() {
  return Response.json(
    { ok: true, sheetConfigured: !!SHEET_URL, time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
