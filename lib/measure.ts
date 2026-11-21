/**
 * Measurement requests: a planner asks warehouse staff to measure one physical piece on a phone or tablet.
 * Framework-free like lib/api.ts, so it can be unit-tested (test/measure.test.ts); app/api/measure/route.ts passes in
 * the real store.
 *
 * What is stored, and for how long (see also public/adeyiq/privacy.html):
 * - only the AWB, the planner's piece reference, the planned and measured L/W/H in cm, how each was measured and
 *   timestamps. No names, no photos (photos never leave the phone), no IP address.
 * - an open request is deleted automatically when its link expires (1 to 72 hours, chosen by the planner);
 *   a submitted result is kept for RESULT_HOURS after submission so the planner can review it, then deleted.
 *   The planner can delete it earlier ("Remove").
 *
 * Links: the token in the link is 128 random bits, sent only in the URL fragment (#t=…) so it never reaches server
 * logs or Referer headers. The store keys a request by SHA-256 of the token, so a copy of the store holds no working
 * link. The token can read and submit only its own request, once. Cancelling also needs the planner key, which only
 * the planner's browser holds.
 */
import { createHash, randomBytes } from "node:crypto";
import { clientKey, clip, rateLimited, sameOrigin } from "./api.ts";

export type Dim = number | null;
export type Dims = { l: Dim; w: Dim; h: Dim };
export type Method = "tape" | "photo";
export type Result = { l: number; w: number; h: number; method: { l: Method; w: Method; h: Method }; at: number; note: string };
export type Rec = { v: 1; awb: string; piece: string; planned: Dims; created: number; expires: number; pk: string };

/** Storage with per-key expiry. Upstash Redis in production, a Map locally. All methods resolve; failures throw. */
export interface MeasureStore {
  /** create only if absent; false if the id is taken */
  create(id: string, rec: Rec, ttlSec: number): Promise<boolean>;
  get(id: string): Promise<{ rec: Rec | null; result: Result | null }>;
  /** save the result only if none exists yet (one submission per link) and keep both keys for ttlSec */
  submitOnce(id: string, result: Result, ttlSec: number): Promise<boolean>;
  del(id: string): Promise<void>;
}

export const MEASURE_LIMIT = {
  maxBody: 4000,
  createPerHour: 60,
  readPerMinute: 120,
  submitPerHour: 30,
  minHours: 1,
  maxHours: 72,
  defaultHours: 24,
  maxCm: 2000, // the Cargo Builder's own per-dimension limit
  statusBatch: 50,
};
export const RESULT_HOURS = 72;

export const hashToken = (t: string) => createHash("sha256").update(t, "utf8").digest("base64url");
const TOKEN = /^[A-Za-z0-9_-]{22}$/;
const newSecret = () => randomBytes(16).toString("base64url"); // 22 characters, 128 bits

/** planned value: a positive number up to the limit, else missing (never 0, never guessed) */
function plannedDim(v: unknown): Dim {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= MEASURE_LIMIT.maxCm ? Math.round(n * 10) / 10 : null;
}
/** measured value: must be a positive number of cm, up to the limit */
export function measuredDim(v: unknown): number | null {
  if (typeof v !== "number" && typeof v !== "string") return null;
  if (typeof v === "string" && !/^\s*\d+(\.\d+)?\s*$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= MEASURE_LIMIT.maxCm ? Math.round(n * 10) / 10 : null;
}
const method = (v: unknown): Method | null => (v === "tape" || v === "photo" ? v : null);

export type MeasureDeps = { store: MeasureStore | null; now?: () => number; log?: (m: string) => void };
type Out = { status: number; body: Record<string, unknown> };

async function readJson(req: Request, max: number): Promise<Record<string, unknown> | number> {
  if (Number(req.headers.get("content-length") || 0) > max) return 413;
  const text = await req.text();
  if (text.length > max) return 413;
  try {
    const d = JSON.parse(text);
    return d && typeof d === "object" && !Array.isArray(d) ? d : 400;
  } catch {
    return 400;
  }
}

const publicView = (rec: Rec, result: Result | null) => ({
  awb: rec.awb,
  piece: rec.piece,
  planned: rec.planned,
  expires: rec.expires,
  status: result ? "submitted" : "open",
  result: result || null,
});

/** POST /api/measure  {op: "create" | "view" | "submit" | "status" | "cancel", …} */
export async function handleMeasure(req: Request, deps: MeasureDeps): Promise<Out> {
  if (!sameOrigin(req)) return { status: 403, body: { ok: false, error: "forbidden" } };
  if (!deps.store) {
    deps.log?.("measurement request refused: no store is configured");
    return { status: 503, body: { ok: false, error: "Measurement requests are not set up on this server." } };
  }
  const store = deps.store;
  const now = deps.now ? deps.now() : Date.now();
  const who = clientKey(req);
  const d = await readJson(req, MEASURE_LIMIT.maxBody);
  if (typeof d === "number") return { status: d, body: { ok: false } };
  const op = clip(d.op, 12);
  const limited = (k: string, n: number, ms: number) => rateLimited(`m${k}:${who}`, n, ms, now);

  try {
    if (op === "create") {
      if (limited("c", MEASURE_LIMIT.createPerHour, 3_600_000)) return { status: 429, body: { ok: false, error: "Too many requests, try again later." } };
      const awb = clip(d.awb, 40).trim(),
        piece = clip(d.piece, 60).trim();
      if (!awb || !piece) return { status: 400, body: { ok: false, error: "AWB and piece reference are required." } };
      const p = (d.planned && typeof d.planned === "object" ? d.planned : {}) as Record<string, unknown>;
      const planned: Dims = { l: plannedDim(p.l), w: plannedDim(p.w), h: plannedDim(p.h) };
      const hours = Math.round(Number(d.hours) || MEASURE_LIMIT.defaultHours);
      if (hours < MEASURE_LIMIT.minHours || hours > MEASURE_LIMIT.maxHours)
        return { status: 400, body: { ok: false, error: `The link must expire within ${MEASURE_LIMIT.minHours} to ${MEASURE_LIMIT.maxHours} hours.` } };
      const token = newSecret(),
        key = newSecret();
      const rec: Rec = { v: 1, awb, piece, planned, created: now, expires: now + hours * 3_600_000, pk: hashToken(key) };
      if (!(await store.create(hashToken(token), rec, hours * 3600))) return { status: 500, body: { ok: false, error: "Could not create the request, try again." } };
      return { status: 200, body: { ok: true, token, key, expires: rec.expires, planned } };
    }

    if (op === "view" || op === "submit" || op === "cancel") {
      const token = String(d.token ?? "");
      if (!TOKEN.test(token)) return { status: 404, body: { ok: false, error: "gone" } };
      if (op === "submit" ? limited("s", MEASURE_LIMIT.submitPerHour, 3_600_000) : limited("r", MEASURE_LIMIT.readPerMinute, 60_000))
        return { status: 429, body: { ok: false, error: "Too many requests, try again later." } };
      const id = hashToken(token);
      const { rec, result } = await store.get(id);
      // the store deletes expired keys itself; this also covers a store whose expiry lags a little
      if (!rec || (!result && rec.expires <= now)) return { status: 404, body: { ok: false, error: "gone" } };

      if (op === "view") return { status: 200, body: { ok: true, ...publicView(rec, result) } };

      if (op === "cancel") {
        if (hashToken(String(d.key ?? "")) !== rec.pk) return { status: 403, body: { ok: false, error: "forbidden" } };
        await store.del(id);
        return { status: 200, body: { ok: true } };
      }

      // submit
      if (result) return { status: 409, body: { ok: false, error: "These dimensions were already sent. Ask the planner for a new link to measure again." } };
      const m = (d.method && typeof d.method === "object" ? d.method : {}) as Record<string, unknown>;
      const l = measuredDim(d.l),
        w = measuredDim(d.w),
        h = measuredDim(d.h);
      const ml = method(m.l),
        mw = method(m.w),
        mh = method(m.h);
      if (l === null || w === null || h === null)
        return { status: 400, body: { ok: false, error: `Enter length, width and height as positive numbers of cm (up to ${MEASURE_LIMIT.maxCm}).` } };
      if (!ml || !mw || !mh) return { status: 400, body: { ok: false, error: "Say how each dimension was measured." } };
      const res: Result = { l, w, h, method: { l: ml, w: mw, h: mh }, at: now, note: clip(d.note, 200).trim() };
      if (!(await store.submitOnce(id, res, RESULT_HOURS * 3600)))
        return { status: 409, body: { ok: false, error: "These dimensions were already sent. Ask the planner for a new link to measure again." } };
      return { status: 200, body: { ok: true, ...publicView(rec, res) } };
    }

    if (op === "status") {
      if (limited("r", MEASURE_LIMIT.readPerMinute, 60_000)) return { status: 429, body: { ok: false, error: "Too many requests, try again later." } };
      const list = (Array.isArray(d.tokens) ? d.tokens : []).slice(0, MEASURE_LIMIT.statusBatch).map((t) => String(t ?? ""));
      const out: Record<string, unknown> = {};
      for (const t of list) {
        if (!TOKEN.test(t)) continue;
        const { rec, result } = await store.get(hashToken(t));
        out[t] = !rec || (!result && rec.expires <= now) ? { status: "gone" } : publicView(rec, result);
      }
      return { status: 200, body: { ok: true, requests: out } };
    }
  } catch (e) {
    deps.log?.("measurement store error: " + (e instanceof Error ? e.message : String(e)));
    return { status: 502, body: { ok: false, error: "The server could not reach its storage, try again." } };
  }
  return { status: 400, body: { ok: false, error: "unknown op" } };
}

/* ---------- stores ---------- */

/** In-memory store for local development and tests only: not shared between server instances, lost on restart. */
export function memoryStore(now: () => number = Date.now): MeasureStore {
  const m = new Map<string, { v: unknown; exp: number }>();
  const live = (k: string) => {
    const e = m.get(k);
    if (e && e.exp <= now()) m.delete(k);
    return m.get(k);
  };
  return {
    async create(id, rec, ttl) {
      if (live("m:" + id)) return false;
      m.set("m:" + id, { v: rec, exp: now() + ttl * 1000 });
      return true;
    },
    async get(id) {
      return { rec: (live("m:" + id)?.v as Rec) || null, result: (live("r:" + id)?.v as Result) || null };
    },
    async submitOnce(id, result, ttl) {
      const rec = live("m:" + id);
      if (!rec || live("r:" + id)) return false;
      const exp = now() + ttl * 1000;
      rec.exp = exp;
      m.set("r:" + id, { v: result, exp });
      return true;
    },
    async del(id) {
      m.delete("m:" + id);
      m.delete("r:" + id);
    },
  };
}

/**
 * Upstash Redis over its REST API (plain fetch, no client library). Keys expire on their own (EX), so nothing needs
 * a clean-up job. Environment variables, set by the Vercel Marketplace "Upstash for Redis" integration:
 *   KV_REST_API_URL, KV_REST_API_TOKEN   (or UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)
 */
export function upstashStore(url: string, token: string, fetchFn: typeof fetch = fetch): MeasureStore {
  const base = url.replace(/\/+$/, "");
  async function pipe(cmds: (string | number)[][]): Promise<unknown[]> {
    const res = await fetchFn(base + "/pipeline", {
      method: "POST",
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error("store HTTP " + res.status);
    const out = (await res.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(out)) throw new Error("store reply");
    return out.map((r) => {
      if (r && r.error) throw new Error("store: " + r.error);
      return r ? r.result : null;
    });
  }
  const parse = <T>(v: unknown): T | null => {
    if (typeof v !== "string") return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  };
  return {
    async create(id, rec, ttl) {
      const [r] = await pipe([["SET", "adeyiq:m:" + id, JSON.stringify(rec), "NX", "EX", ttl]]);
      return r === "OK";
    },
    async get(id) {
      const [a, b] = await pipe([
        ["GET", "adeyiq:m:" + id],
        ["GET", "adeyiq:r:" + id],
      ]);
      return { rec: parse<Rec>(a), result: parse<Result>(b) };
    },
    async submitOnce(id, result, ttl) {
      // SET NX makes the first submission win even if two arrive at once; then the request lives as long as its result
      const [r] = await pipe([["SET", "adeyiq:r:" + id, JSON.stringify(result), "NX", "EX", ttl]]);
      if (r !== "OK") return false;
      await pipe([["EXPIRE", "adeyiq:m:" + id, ttl]]);
      return true;
    },
    async del(id) {
      await pipe([["DEL", "adeyiq:m:" + id, "adeyiq:r:" + id]]);
    },
  };
}

/**
 * The store this server uses, picked from the environment:
 * - Upstash Redis when KV_REST_API_URL + KV_REST_API_TOKEN (or the UPSTASH_REDIS_REST_* pair) are set;
 * - otherwise an in-memory store, but only outside production or when ADEYIQ_MEASURE_STORE=memory is set
 *   explicitly (the local end-to-end run uses that with `next start`; never set it on Vercel);
 * - otherwise none: the API answers 503 and the Cargo Builder says measurement requests are not set up (fail closed).
 */
export function storeFromEnv(env: Record<string, string | undefined> = process.env): MeasureStore | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL || "",
    token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN || "";
  if (url && token) return upstashStore(url, token);
  if (env.ADEYIQ_MEASURE_STORE === "memory" || env.NODE_ENV !== "production") {
    const g = globalThis as { __adeyiqMeasureMem?: MeasureStore };
    return (g.__adeyiqMeasureMem ??= memoryStore());
  }
  return null;
}
/** Which store is in use, for /api/health and logs (never a URL or token). */
export function storeKind(env: Record<string, string | undefined> = process.env): "upstash" | "memory" | "none" {
  if ((env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL) && (env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN)) return "upstash";
  return env.ADEYIQ_MEASURE_STORE === "memory" || env.NODE_ENV !== "production" ? "memory" : "none";
}
