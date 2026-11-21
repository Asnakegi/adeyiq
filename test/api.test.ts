// Unit tests for the public API handlers (lib/api.ts). Run: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handleTrack, handleRequest, resetRateLimits, rateLimited, sameOrigin, TRACK_LIMIT, REQUEST_LIMIT } from "../lib/api.ts";
import { handleMeasure, memoryStore, upstashStore, storeFromEnv, storeKind, hashToken, MEASURE_LIMIT, RESULT_HOURS } from "../lib/measure.ts";

const HOST = "adeyiq.example";
let ipSeq = 0;
function post(path: string, body: unknown, h: Record<string, string> = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(`https://${HOST}${path}`, {
    method: "POST",
    body: text,
    headers: { origin: `https://${HOST}`, host: HOST, "x-forwarded-for": h.ip ?? `10.0.0.${++ipSeq % 250}`, "user-agent": "Mozilla/5.0", ...h },
  });
}
const okWriter = () => {
  const rows: Record<string, unknown>[] = [];
  return { rows, deps: { configured: true, write: async (r: Record<string, unknown>) => (rows.push(r), true), log: () => {} } };
};
const goodReq = { name: "Ana", email: "ana@cargo.example", company: "GSA", modules: ["1", "2"], message: "hi" };

beforeEach(() => resetRateLimits());

test("sameOrigin: accepts own host, rejects other or missing Origin", () => {
  assert.equal(sameOrigin(post("/api/track", {})), true);
  assert.equal(sameOrigin(post("/api/track", {}, { origin: "https://evil.example" })), false);
  const noOrigin = new Request(`https://${HOST}/api/track`, { method: "POST", body: "{}", headers: { host: HOST } });
  assert.equal(sameOrigin(noOrigin), false);
  assert.equal(sameOrigin(post("/api/track", {}, { origin: "not a url" })), false);
});

test("track: valid event returns a row with location and device, never the IP", async () => {
  const r = await handleTrack(
    post("/api/track", { event: "open", page: "/build", visitor: "abc", w: 400 }, { "x-vercel-ip-country": "ET", "x-vercel-ip-city": "Addis%20Ababa", ip: "1.2.3.4" }),
    okWriter().deps,
  );
  assert.equal(r.status, 204);
  assert.equal(r.row?.event, "open");
  assert.equal(r.row?.device, "phone");
  assert.equal(r.row?.city, "Addis Ababa");
  assert.ok(!JSON.stringify(r.row).includes("1.2.3.4"));
});

test("track: bots are ignored, cross-site posts refused, unknown events rejected", async () => {
  const d = okWriter().deps;
  assert.deepEqual(await handleTrack(post("/api/track", { event: "open" }, { "user-agent": "Googlebot/2.1" }), d), { status: 204 });
  assert.equal((await handleTrack(post("/api/track", { event: "open" }, { origin: "https://evil.example" }), d)).status, 403);
  assert.equal((await handleTrack(post("/api/track", { event: "drop table" }), d)).status, 400);
  assert.equal((await handleTrack(post("/api/track", "not json"), d)).status, 400);
  assert.equal((await handleTrack(post("/api/track", "[1,2]"), d)).status, 400);
});

test("track: oversized body is refused before parsing", async () => {
  const big = JSON.stringify({ event: "open", detail: "x".repeat(TRACK_LIMIT.maxBody) });
  assert.equal((await handleTrack(post("/api/track", big), okWriter().deps)).status, 413);
});

test("track: long fields are clipped", async () => {
  const r = await handleTrack(post("/api/track", { event: "feedback", detail: "y".repeat(299) + "zzzz", visitor: "v".repeat(50) }), okWriter().deps);
  assert.equal((r.row?.detail as string).length, 300);
  assert.equal((r.row?.visitor as string).length, 20);
});

test("track: rate limit per client per minute", async () => {
  const d = { ...okWriter().deps, now: () => 1_000_000 };
  for (let i = 0; i < TRACK_LIMIT.perMinute; i++) assert.equal((await handleTrack(post("/api/track", { event: "open" }, { ip: "9.9.9.9" }), d)).status, 204);
  assert.equal((await handleTrack(post("/api/track", { event: "open" }, { ip: "9.9.9.9" }), d)).status, 429);
  assert.equal((await handleTrack(post("/api/track", { event: "open" }, { ip: "9.9.9.8" }), d)).status, 204, "other clients unaffected");
  const later = { ...d, now: () => 1_000_000 + 61_000 };
  assert.equal((await handleTrack(post("/api/track", { event: "open" }, { ip: "9.9.9.9" }), later)).status, 204, "window slides");
});

test("request: writes the row and returns ok", async () => {
  const w = okWriter();
  const r = await handleRequest(post("/api/request", goodReq, { "x-vercel-ip-city": "Dubai", "x-vercel-ip-country": "AE" }), w.deps);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(w.rows.length, 1);
  assert.equal(w.rows[0].email, "ana@cargo.example");
  assert.equal(w.rows[0].page, "Dubai, AE");
});

test("request: not configured gives 503 and logs", async () => {
  const logs: string[] = [];
  const r = await handleRequest(post("/api/request", goodReq), { configured: false, write: async () => true, log: (m) => logs.push(m) });
  assert.equal(r.status, 503);
  assert.equal(logs.length, 1);
});

test("request: cross-site, bad JSON, missing name or bad email are refused without writing", async () => {
  const w = okWriter();
  assert.equal((await handleRequest(post("/api/request", goodReq, { origin: "https://evil.example" }), w.deps)).status, 403);
  assert.equal((await handleRequest(post("/api/request", "{oops"), w.deps)).status, 400);
  assert.equal((await handleRequest(post("/api/request", { ...goodReq, name: "  " }), w.deps)).status, 400);
  assert.equal((await handleRequest(post("/api/request", { ...goodReq, email: "nope" }), w.deps)).status, 400);
  assert.equal(w.rows.length, 0);
});

test("request: honeypot field answers ok but writes nothing", async () => {
  const w = okWriter();
  const r = await handleRequest(post("/api/request", { ...goodReq, website: "http://spam" }), w.deps);
  assert.equal(r.status, 200);
  assert.equal(w.rows.length, 0);
});

test("request: modules capped at 5 and message clipped", async () => {
  const w = okWriter();
  await handleRequest(post("/api/request", { ...goodReq, modules: ["a", "b", "c", "d", "e", "f", "g"], message: "m".repeat(5000) }), w.deps);
  assert.equal((w.rows[0].modules as string[]).length, 5);
  assert.equal((w.rows[0].message as string).length, 2000);
});

test("request: oversized body 413", async () => {
  const r = await handleRequest(post("/api/request", { ...goodReq, message: "m".repeat(REQUEST_LIMIT.maxBody) }), okWriter().deps);
  assert.equal(r.status, 413);
});

test("request: sheet failure gives 502 and logs so the form can show its fallback", async () => {
  const logs: string[] = [];
  const r = await handleRequest(post("/api/request", goodReq), { configured: true, write: async () => false, log: (m) => logs.push(m) });
  assert.equal(r.status, 502);
  assert.deepEqual(r.body, { ok: false });
  assert.equal(logs.length, 1);
});

test("rate limits: pruning busy usage traffic never resets an hourly access-request limit", () => {
  const t0 = 9_000_000;
  for (let i = 0; i < REQUEST_LIMIT.perHour; i++) assert.equal(rateLimited("r:6.6.6.6", REQUEST_LIMIT.perHour, 3_600_000, t0), false);
  assert.equal(rateLimited("r:6.6.6.6", REQUEST_LIMIT.perHour, 3_600_000, t0), true);
  // 61 s later, 5,001 different clients send usage events (1-minute window), which triggers pruning
  for (let i = 0; i < 5001; i++) rateLimited("t:c" + i, TRACK_LIMIT.perMinute, 60_000, t0 + 61_000);
  assert.equal(rateLimited("r:6.6.6.6", REQUEST_LIMIT.perHour, 3_600_000, t0 + 62_000), true, "still limited within the hour");
  assert.equal(rateLimited("r:6.6.6.6", REQUEST_LIMIT.perHour, 3_600_000, t0 + 3_600_001), false, "free again after the hour");
});

test("request: 5 per hour per client", async () => {
  const w = okWriter();
  const d = { ...w.deps, now: () => 5_000_000 };
  for (let i = 0; i < REQUEST_LIMIT.perHour; i++) assert.equal((await handleRequest(post("/api/request", goodReq, { ip: "7.7.7.7" }), d)).status, 200);
  assert.equal((await handleRequest(post("/api/request", goodReq, { ip: "7.7.7.7" }), d)).status, 429);
  assert.equal(w.rows.length, REQUEST_LIMIT.perHour);
});

/* ---------- measurement requests (lib/measure.ts) ---------- */
function measureEnv(start = 1_800_000_000_000) {
  let t = start;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const store = memoryStore(clock.now);
  const call = (body: unknown, h: Record<string, string> = {}) =>
    handleMeasure(post("/api/measure", body, { ip: "10.9.0.1", ...h }), { store, now: clock.now, log: () => {} });
  return { clock, store, call };
}
const PLANNED = { l: 120, w: 80, h: 75 };
const TAPE = { l: "tape", w: "tape", h: "tape" };

test("measure: create → view → submit → status, one piece, link token never stored in clear", async () => {
  const { call, store } = measureEnv();
  const c = await call({ op: "create", awb: "071-12345675", piece: "Piece 2 of 3", planned: PLANNED, hours: 24 });
  assert.equal(c.status, 200);
  const token = c.body.token as string;
  assert.match(token, /^[A-Za-z0-9_-]{22}$/);
  assert.match(c.body.key as string, /^[A-Za-z0-9_-]{22}$/);
  assert.notEqual(c.body.key, token);
  assert.equal((await store.get(token)).rec, null, "the store is keyed by a hash, not by the token itself");
  assert.ok((await store.get(hashToken(token))).rec);
  const v = await call({ op: "view", token });
  assert.equal(v.status, 200);
  assert.deepEqual([v.body.awb, v.body.piece, v.body.status], ["071-12345675", "Piece 2 of 3", "open"]);
  assert.deepEqual(v.body.planned, PLANNED);
  assert.equal(JSON.stringify(v.body).includes('"pk"'), false, "the planner key hash is never shown to the phone");
  const s = await call({ op: "submit", token, l: 132, w: 80, h: "78", method: { l: "tape", w: "photo", h: "tape" }, note: "skid included" });
  assert.equal(s.status, 200);
  assert.deepEqual(s.body.result, { l: 132, w: 80, h: 78, method: { l: "tape", w: "photo", h: "tape" }, at: 1_800_000_000_000, note: "skid included" });
  assert.equal((await call({ op: "submit", token, l: 1, w: 1, h: 1, method: TAPE })).status, 409, "one submission per link");
  const st = await call({ op: "status", tokens: [token, "x".repeat(22), "bad"] });
  const reqs = st.body.requests as Record<string, { status: string; result?: { l: number } }>;
  assert.equal(reqs[token].status, "submitted");
  assert.equal(reqs[token].result?.l, 132);
  assert.equal(reqs["x".repeat(22)].status, "gone");
  assert.equal(reqs.bad, undefined);
});

test("measure: missing planned dimensions stay missing; AWB and piece are required", async () => {
  const { call } = measureEnv();
  const c = await call({ op: "create", awb: "071-1", piece: "P1", planned: { l: 0, w: "", h: -5 } });
  assert.equal(c.status, 200);
  assert.deepEqual(c.body.planned, { l: null, w: null, h: null });
  const half = await call({ op: "create", awb: "071-1", piece: "P1", planned: { l: 100, h: 3000 } });
  assert.deepEqual(half.body.planned, { l: 100, w: null, h: null }, "a value above the limit is treated as missing, never guessed");
  assert.equal((await call({ op: "create", awb: "", piece: "P1" })).status, 400);
  assert.equal((await call({ op: "create", awb: "071-1", piece: "  " })).status, 400);
  assert.equal((await call({ op: "create", awb: "071-1", piece: "P", hours: 0.2 })).status, 400);
  assert.equal((await call({ op: "create", awb: "071-1", piece: "P", hours: 73 })).status, 400);
});

test("measure: submissions must be three positive cm values with a method each", async () => {
  const { call } = measureEnv();
  const token = (await call({ op: "create", awb: "A", piece: "P" })).body.token;
  for (const bad of [
    { l: 0, w: 80, h: 75, method: TAPE },
    { l: -1, w: 80, h: 75, method: TAPE },
    { l: 120, w: null, h: 75, method: TAPE },
    { l: 120, w: 80, h: "75cm", method: TAPE },
    { l: 120, w: 80, h: MEASURE_LIMIT.maxCm + 1, method: TAPE },
    { l: 120, w: 80, h: 75, method: { l: "laser", w: "tape", h: "tape" } },
    { l: 120, w: 80, h: 75 },
  ])
    assert.equal((await call({ op: "submit", token, ...bad })).status, 400, JSON.stringify(bad));
  assert.equal((await call({ op: "view", token })).body.status, "open", "a refused submission changes nothing");
});

test("measure: links expire; a result outlives the link for the review period, then is deleted", async () => {
  const { call, clock } = measureEnv();
  const a = (await call({ op: "create", awb: "A", piece: "P", hours: 4 })).body.token;
  const b = (await call({ op: "create", awb: "B", piece: "P", hours: 4 })).body.token;
  clock.advance(3 * 3_600_000);
  assert.equal((await call({ op: "submit", token: b, l: 1, w: 2, h: 3, method: TAPE })).status, 200);
  clock.advance(3_600_000 + 1);
  assert.equal((await call({ op: "view", token: a })).status, 404, "unsubmitted link is gone after expiry");
  assert.equal((await call({ op: "submit", token: a, l: 1, w: 2, h: 3, method: TAPE })).status, 404, "cannot submit after expiry");
  assert.equal((await call({ op: "view", token: b })).body.status, "submitted", "a submitted result stays readable for the planner");
  clock.advance(RESULT_HOURS * 3_600_000);
  assert.equal((await call({ op: "view", token: b })).status, 404, "result deleted after the review period");
});

test("measure: cancel needs the planner key; random or malformed tokens reveal nothing", async () => {
  const { call } = measureEnv();
  const c = (await call({ op: "create", awb: "A", piece: "P" })).body;
  assert.equal((await call({ op: "cancel", token: c.token, key: "wrong-key-wrong-key-12" })).status, 403);
  assert.equal((await call({ op: "view", token: c.token })).status, 200);
  assert.equal((await call({ op: "cancel", token: c.token, key: c.key })).status, 200);
  assert.equal((await call({ op: "view", token: c.token })).status, 404);
  for (const t of ["", "../../etc", "a".repeat(23), { $gt: "" }]) assert.equal((await call({ op: "view", token: t })).status, 404);
  assert.equal((await call({ op: "nope" })).status, 400);
});

test("measure: same-origin, body size, rate limit, and fail closed without a store", async () => {
  const { call } = measureEnv();
  assert.equal((await call({ op: "create", awb: "A", piece: "P" }, { origin: "https://evil.example" })).status, 403);
  assert.equal((await call({ op: "create", awb: "A", piece: "x".repeat(MEASURE_LIMIT.maxBody) })).status, 413);
  const codes: number[] = [];
  for (let i = 0; i <= MEASURE_LIMIT.createPerHour; i++) codes.push((await call({ op: "create", awb: "A", piece: "P" }, { ip: "10.9.9.9" })).status);
  assert.equal(codes.at(-1), 429);
  assert.equal(codes.filter((c) => c === 200).length, MEASURE_LIMIT.createPerHour);
  const none = await handleMeasure(post("/api/measure", { op: "view", token: "a".repeat(22) }), { store: null, log: () => {} });
  assert.equal(none.status, 503);
});

test("measure: store selection from the environment", () => {
  assert.equal(storeKind({ NODE_ENV: "production" }), "none");
  assert.equal(storeFromEnv({ NODE_ENV: "production" }), null, "production without Redis has no store (fail closed)");
  assert.equal(storeKind({ NODE_ENV: "production", ADEYIQ_MEASURE_STORE: "memory" }), "memory");
  assert.equal(storeKind({ NODE_ENV: "development" }), "memory");
  assert.equal(storeKind({ NODE_ENV: "production", KV_REST_API_URL: "https://x.upstash.io", KV_REST_API_TOKEN: "t" }), "upstash");
  assert.equal(storeKind({ NODE_ENV: "production", UPSTASH_REDIS_REST_URL: "https://x.upstash.io", UPSTASH_REDIS_REST_TOKEN: "t" }), "upstash");
});

test("measure: Upstash store sends the expected Redis commands (mock fetch, no network)", async () => {
  const sent: unknown[] = [];
  const db = new Map<string, string>();
  const fake = (async (url: string, init: RequestInit) => {
    assert.equal(url, "https://eu1.example.upstash.io/pipeline");
    assert.equal((init.headers as Record<string, string>).Authorization, "Bearer tok");
    const cmds = JSON.parse(String(init.body)) as (string | number)[][];
    sent.push(...cmds);
    const out = cmds.map(([c, k, v, nx]) => {
      if (c === "SET") {
        if (nx === "NX" && db.has(String(k))) return { result: null };
        db.set(String(k), String(v));
        return { result: "OK" };
      }
      if (c === "GET") return { result: db.get(String(k)) ?? null };
      return { result: 1 };
    });
    return new Response(JSON.stringify(out), { status: 200 });
  }) as unknown as typeof fetch;
  const s = upstashStore("https://eu1.example.upstash.io/", "tok", fake);
  const rec = { v: 1 as const, awb: "A", piece: "P", planned: { l: 1, w: null, h: null }, created: 0, expires: 1, pk: "h" };
  assert.equal(await s.create("id1", rec, 3600), true);
  assert.equal(await s.create("id1", rec, 3600), false);
  assert.deepEqual((await s.get("id1")).rec, rec);
  const res = { l: 1, w: 2, h: 3, method: { l: "tape" as const, w: "tape" as const, h: "photo" as const }, at: 5, note: "" };
  assert.equal(await s.submitOnce("id1", res, 7200), true);
  assert.equal(await s.submitOnce("id1", res, 7200), false, "second submission refused by SET NX");
  await s.del("id1");
  assert.deepEqual(sent[0], ["SET", "adeyiq:m:id1", JSON.stringify(rec), "NX", "EX", 3600]);
  assert.ok(sent.some((c) => JSON.stringify(c) === JSON.stringify(["EXPIRE", "adeyiq:m:id1", 7200])), "the request lives as long as its result");
  assert.ok(sent.some((c) => JSON.stringify(c) === JSON.stringify(["DEL", "adeyiq:m:id1", "adeyiq:r:id1"])));
});
