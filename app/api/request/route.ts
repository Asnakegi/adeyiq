import { handleRequest } from "@/lib/api";
import { sheetProblem, sheetReady, toSheetRetry } from "@/lib/sheet";

export const maxDuration = 30;

/* Access requests from the home page form → "Access requests" tab of the Google Sheet (and an email to the owner). */
export async function POST(request: Request) {
  const r = await handleRequest(request, {
    write: toSheetRetry,
    configured: sheetReady(),
    log: (m) => console.warn("[request] " + m + (sheetReady() ? "" : " (" + sheetProblem() + ")")),
  });
  return Response.json(r.body, { status: r.status });
}
