import { after } from "next/server";
import { handleTrack } from "@/lib/api";
import { SHEET_URL, toSheetRetry } from "@/lib/sheet";

/* retries after the response may take up to ~12 s */
export const maxDuration = 30;

/* Usage events from the AdeyIQ pages (public/adeyiq/track.js) → "Usage" tab of the Google Sheet. */
export async function POST(request: Request) {
  const r = await handleTrack(request, { write: toSheetRetry, configured: !!SHEET_URL });
  if (r.row && SHEET_URL) {
    const row = r.row;
    after(async () => {
      if (!(await toSheetRetry(row))) console.warn("[track] usage event could not be written to the sheet after retries");
    });
  }
  return new Response(null, { status: r.status });
}
