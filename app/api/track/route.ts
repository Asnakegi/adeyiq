import { after } from "next/server";
import { handleTrack } from "@/lib/api";
import { sheetProblem, sheetReady, toSheetRetry } from "@/lib/sheet";

/* retries after the response may take up to ~12 s */
export const maxDuration = 30;
let warned = false;

/* Usage events from the AdeyIQ pages (public/adeyiq/track.js) → "Usage" tab of the Google Sheet. */
export async function POST(request: Request) {
  const r = await handleTrack(request, { write: toSheetRetry, configured: sheetReady() });
  if (r.row && sheetReady()) {
    const row = r.row;
    after(async () => {
      if (!(await toSheetRetry(row))) console.warn("[track] usage event could not be written to the sheet after retries");
    });
  } else if (r.row && !warned) {
    warned = true; // once per server instance: fail closed, but not silently
    console.warn("[track] usage events are not recorded: " + sheetProblem());
  }
  return new Response(null, { status: r.status });
}
