import { after } from "next/server";
import { clip, locationOf, toSheetRetry } from "@/lib/sheet";

/* retries after the response may take up to ~12 s */
export const maxDuration = 30;

/* Usage events from the AdeyIQ pages (public/adeyiq/track.js) → "Usage" tab of the Google Sheet. */
const EVENTS = new Set([
  "open",
  "add cargo",
  "upload file",
  "try sample",
  "change aircraft",
  "load aircraft",
  "rebalance",
  "loading animation",
  "replay build-up",
  "request access opened",
  "feedback",
]);
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|monitor/i;

export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") || "";
  if (BOT.test(ua)) return new Response(null, { status: 204 });
  let d: Record<string, unknown>;
  try {
    d = JSON.parse((await request.text()).slice(0, 4000));
  } catch {
    return new Response(null, { status: 400 });
  }
  const event = clip(d.event, 40);
  if (!EVENTS.has(event)) return new Response(null, { status: 400 });
  const w = Number(d.w) || 0;
  const row = {
    type: "usage",
    event,
    page: clip(d.page, 80),
    visitor: clip(d.visitor, 20),
    session: clip(d.session, 20),
    aircraft: clip(d.aircraft, 40),
    detail: clip(d.detail, 300),
    device: w && w < 768 ? "phone" : w && w < 1100 ? "tablet" : "desktop",
    ref: clip(d.ref, 200),
    ...locationOf(request.headers),
  };
  after(() => toSheetRetry(row));
  return new Response(null, { status: 204 });
}
