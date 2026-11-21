import { handleMeasure, storeFromEnv, storeKind } from "@/lib/measure";

export const dynamic = "force-dynamic";

/* Measurement requests: the Cargo Builder (/build) creates one per piece, the phone page (/measure) reads and submits it.
   Storage and retention are described in lib/measure.ts. */
export async function POST(request: Request) {
  const r = await handleMeasure(request, {
    store: storeFromEnv(),
    log: (m) => console.warn("[measure] " + m + " (store: " + storeKind() + ")"),
  });
  return Response.json(r.body, { status: r.status, headers: { "Cache-Control": "no-store" } });
}
