import { after } from "next/server";
import { accessHashes, handleAccess } from "@/lib/api";
import { sheetReady, toSheetRetry } from "@/lib/sheet";

export const maxDuration = 30;

/* Access codes for Module 2 (Optimize revenue). ADEYIQ_ACCESS_CODES holds SHA-256 hashes of the codes the owner gives out
   (make one with: node scripts/make-access-code.mjs). Without it the endpoint answers 503 and Module 2 stays locked. */
export async function POST(request: Request) {
  const r = await handleAccess(request, { hashes: accessHashes(process.env.ADEYIQ_ACCESS_CODES), log: (m) => console.warn("[access] " + m) });
  if (r.row && sheetReady()) {
    const row = r.row;
    after(async () => {
      if (!(await toSheetRetry(row))) console.warn("[access] usage event could not be written to the sheet after retries");
    });
  }
  return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
