/**
 * Request handling for the public API routes, kept free of framework imports so it can be unit-tested
 * (tests/api.test.ts). The routes in app/api/* pass in the real sheet writer.
 *
 * Abuse protection, sized for a small public site on serverless functions:
 * - same-origin check: browsers always send Origin on POST; posts from other sites are refused
 * - body size limits before parsing
 * - per-client rate limits (per server instance, best effort: a determined attacker can still spread
 *   requests over instances, but casual flooding of the sheet and the owner's email quota is stopped)
 */

export type SheetWriter = (body: Record<string, unknown>) => Promise<boolean>;
export type Deps = { write: SheetWriter; configured: boolean; log?: (msg: string) => void; now?: () => number };

export const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

export const EVENTS = new Set([
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

/** Visitor location from Vercel's network headers. The IP address itself is never stored or forwarded. */
export function locationOf(h: Headers) {
  const dec = (v: string | null) => {
    if (!v) return "";
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    country: clip(h.get("x-vercel-ip-country"), 4),
    region: clip(dec(h.get("x-vercel-ip-country-region")), 60),
    city: clip(dec(h.get("x-vercel-ip-city")), 80),
  };
}

/* ---------- same-origin check ---------- */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    const o = new URL(origin).host;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || new URL(req.url).host;
    return o === host;
  } catch {
    return false;
  }
}

/* ---------- rate limits (sliding window, per server instance) ---------- */
const hits = new Map<string, number[]>();
export function clientKey(req: Request) {
  const fwd = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  return fwd.split(",")[0].trim();
}
export function rateLimited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return true;
  }
  arr.push(now);
  hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return false;
}
export function resetRateLimits() {
  hits.clear();
}

async function readBody(req: Request, max: number): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: number }> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > max) return { ok: false, status: 413 };
  const text = await req.text();
  if (text.length > max) return { ok: false, status: 413 };
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) return { ok: false, status: 400 };
    return { ok: true, data };
  } catch {
    return { ok: false, status: 400 };
  }
}

/* ---------- POST /api/track ---------- */
export const TRACK_LIMIT = { perMinute: 60, maxBody: 4000 };
export async function handleTrack(req: Request, deps: Deps): Promise<{ status: number; row?: Record<string, unknown> }> {
  const ua = req.headers.get("user-agent") || "";
  if (BOT.test(ua)) return { status: 204 };
  if (!sameOrigin(req)) return { status: 403 };
  if (rateLimited("t:" + clientKey(req), TRACK_LIMIT.perMinute, 60_000, deps.now?.())) return { status: 429 };
  const b = await readBody(req, TRACK_LIMIT.maxBody);
  if (!b.ok) return { status: b.status };
  const d = b.data;
  const event = clip(d.event, 40);
  if (!EVENTS.has(event)) return { status: 400 };
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
    ...locationOf(req.headers),
  };
  return { status: 204, row };
}

/* ---------- POST /api/request ---------- */
export const REQUEST_LIMIT = { perHour: 5, maxBody: 8000 };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export async function handleRequest(req: Request, deps: Deps): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!deps.configured) {
    deps.log?.("access request refused: ADEYIQ_SHEET_URL is not set");
    return { status: 503, body: { ok: false, error: "not set up" } };
  }
  if (!sameOrigin(req)) return { status: 403, body: { ok: false, error: "forbidden" } };
  if (rateLimited("r:" + clientKey(req), REQUEST_LIMIT.perHour, 3_600_000, deps.now?.()))
    return { status: 429, body: { ok: false, error: "too many requests, try again later" } };
  const b = await readBody(req, REQUEST_LIMIT.maxBody);
  if (!b.ok) return { status: b.status, body: { ok: false } };
  const d = b.data;
  if (d.website) return { status: 200, body: { ok: true } }; // hidden field filled in: a bot
  const name = clip(d.name, 200).trim(),
    email = clip(d.email, 200).trim();
  if (!name || !EMAIL.test(email)) return { status: 400, body: { ok: false, error: "name and email are required" } };
  const loc = locationOf(req.headers);
  const ok = await deps.write({
    type: "request",
    name,
    email,
    company: clip(d.company, 200),
    phone: clip(d.phone, 60),
    modules: (Array.isArray(d.modules) ? d.modules : []).slice(0, 5).map((m) => clip(m, 60)),
    message: clip(d.message, 2000),
    page: [loc.city, loc.country].filter(Boolean).join(", ") || clip(d.page, 200),
  });
  if (!ok) deps.log?.("access request could not be written to the sheet after retries");
  return { status: ok ? 200 : 502, body: { ok } };
}
