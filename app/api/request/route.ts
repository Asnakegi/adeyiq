import { handleRequest } from "@/lib/api";
import { SHEET_URL, toSheetRetry } from "@/lib/sheet";

export const maxDuration = 30;

/* Access requests from the home page form → "Access requests" tab of the Google Sheet (and an email to the owner). */
export async function POST(request: Request) {
  const r = await handleRequest(request, {
    write: toSheetRetry,
    configured: !!SHEET_URL,
    log: (m) => console.warn("[request] " + m),
  });
  return Response.json(r.body, { status: r.status });
}
