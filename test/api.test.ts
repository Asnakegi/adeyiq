// Unit tests for the public API handlers (lib/api.ts). Run: npm test
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { handleTrack, handleRequest, resetRateLimits, sameOrigin, TRACK_LIMIT, REQUEST_LIMIT } from "../lib/api.ts";

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

test("request: 5 per hour per client", async () => {
  const w = okWriter();
  const d = { ...w.deps, now: () => 5_000_000 };
  for (let i = 0; i < REQUEST_LIMIT.perHour; i++) assert.equal((await handleRequest(post("/api/request", goodReq, { ip: "7.7.7.7" }), d)).status, 200);
  assert.equal((await handleRequest(post("/api/request", goodReq, { ip: "7.7.7.7" }), d)).status, 429);
  assert.equal(w.rows.length, REQUEST_LIMIT.perHour);
});
