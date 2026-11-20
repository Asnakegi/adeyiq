// Behaviour of the real Apps Script (scripts/access-requests.gs), run with stand-in Google services. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGs, sign } from "./gs-harness.mjs";

const KEY = "k".repeat(20) + "-test-key-0123456789"; // 40 characters
const usage = { type: "usage", event: "open", page: "/build", visitor: "v1", detail: "9 ULDs built" };

test("valid signed write is accepted and appended", () => {
  const g = loadGs({ key: KEY });
  assert.deepEqual(g.doPost(sign(usage, KEY)), { ok: true });
  assert.equal(g.appended.length, 1);
  assert.equal(g.appended[0].tab, "Usage");
});

test("fails closed when ADEYIQ_KEY is not configured, or too short", () => {
  for (const key of ["", "short-key"]) {
    const g = loadGs({ key });
    assert.deepEqual(g.doPost(sign(usage, key || "anything")), { ok: false });
    assert.equal(g.appended.length, 0, `nothing written with key "${key}"`);
    assert.match(g.logs.map((l) => l[1]).join(), /ADEYIQ_KEY is missing or shorter/);
  }
});

test("missing envelope, wrong key, tampered payload and old unsigned format are refused", () => {
  const g = loadGs({ key: KEY });
  assert.deepEqual(g.doPost(usage), { ok: false }, "old unsigned format");
  assert.deepEqual(g.doPost({ ...usage, key: KEY }), { ok: false }, "plain key in the body (previous design)");
  assert.deepEqual(g.doPost(sign(usage, "x".repeat(40))), { ok: false }, "wrong key");
  const t = sign(usage, KEY);
  t.payload = t.payload.replace("open", "feedback");
  assert.deepEqual(g.doPost(t), { ok: false }, "payload changed after signing");
  assert.deepEqual(g.doPost("not json"), { ok: false });
  assert.deepEqual(g.doPost(""), { ok: false });
  assert.equal(g.appended.length, 0);
});

test("replays and stale or future timestamps are refused", () => {
  const g = loadGs({ key: KEY });
  const env = sign(usage, KEY);
  assert.deepEqual(g.doPost(env), { ok: true });
  assert.deepEqual(g.doPost(env), { ok: false }, "same envelope twice");
  assert.deepEqual(g.doPost(sign(usage, KEY, Date.now() - 6 * 60 * 1000)), { ok: false }, "6 minutes old");
  assert.deepEqual(g.doPost(sign(usage, KEY, Date.now() + 6 * 60 * 1000)), { ok: false }, "6 minutes in the future");
  assert.equal(g.appended.length, 1);
});

test("flood cap: more than 120 writes in a minute are refused", () => {
  const g = loadGs({ key: KEY, now: () => 1_800_000_000_000 });
  let ok = 0;
  for (let i = 0; i < 130; i++) if (g.doPost(sign(usage, KEY, 1_800_000_000_000)).ok) ok++;
  assert.equal(ok, 120);
});

test("formula-like text is stored as plain text (= + - @ TAB CR)", () => {
  const g = loadGs({ key: KEY });
  for (const v of ["=1+1", "+cmd", "-2", "@SUM(A1)", "\t=1", "\r=1"]) g.doPost(sign({ ...usage, detail: v }, KEY));
  assert.deepEqual(g.appended.map((a) => a.row[9]), ["'=1+1", "'+cmd", "'-2", "'@SUM(A1)", "'\t=1", "'\r=1"]);
});

test("access requests: validated, honeypot ignored, emails capped at 50 a day", () => {
  const g = loadGs({ key: KEY });
  const req = { type: "request", name: "Ana", email: "ana@cargo.example", company: "GSA", modules: ["Optimize revenue"], message: "hi" };
  assert.deepEqual(g.doPost(sign({ ...req, email: "bad" }, KEY)), { ok: false });
  assert.deepEqual(g.doPost(sign({ ...req, website: "http://spam" }, KEY)), { ok: true });
  assert.equal(g.appended.length, 0);
  for (let i = 0; i < 55; i++) g.doPost(sign(req, KEY));
  assert.equal(g.appended.filter((a) => a.tab === "Access requests").length, 55);
  assert.equal(g.mails.length, 50);
});

test("unknown types are refused; replies and logs never contain the key or row data", () => {
  const g = loadGs({ key: KEY });
  assert.deepEqual(g.doPost(sign({ type: "admin", cmd: "read" }, KEY)), { ok: false });
  g.doPost(sign(usage, "y".repeat(40)));
  g.doPost(sign({ type: "usage", visitor: "SECRETVISITOR" }, KEY).payload); // payload sent without envelope
  const text = JSON.stringify(g.logs);
  assert.ok(!text.includes(KEY) && !text.includes("SECRETVISITOR"), text);
});

test("email budget is kept per UTC day in Script properties, not the 6-hour cache", () => {
  let clock = Date.UTC(2026, 10, 20, 8, 0, 0);
  const g = loadGs({ key: KEY, now: () => clock });
  const req = { type: "request", name: "Ana", email: "ana@cargo.example" };
  for (let i = 0; i < 52; i++) { g.doPost(sign(req, KEY, clock)); clock += 61_000; } // spread over ~53 minutes (under the per-minute cap)
  assert.equal(g.mails.length, 50);
  g.cache.clear(); // cache eviction must not reset the daily budget
  g.doPost(sign(req, KEY, clock));
  assert.equal(g.mails.length, 50);
  clock = Date.UTC(2026, 10, 21, 0, 5, 0); // next UTC day
  g.doPost(sign(req, KEY, clock));
  assert.equal(g.mails.length, 51);
  assert.deepEqual([...g.props.keys()], ["mail:2026-11-21"], "old day counters are removed");
});

test("a failed notification email does not fail a saved request, and logs no user data", () => {
  const g = loadGs({ key: KEY, mailError: "Invalid email: private.person@example.test" });
  const r = g.doPost(sign({ type: "request", name: "Ana", email: "private.person@example.test" }, KEY));
  assert.deepEqual(r, { ok: true }, "the row is saved, so the website must not retry");
  assert.equal(g.appended.length, 1);
  const text = JSON.stringify(g.logs);
  assert.ok(g.logs.some((l) => l[1] === "AdeyIQ request saved; notification email failed (Error)"), text);
  assert.ok(!text.includes("private.person"), text);
});

test("retries of one write (same rid) save one row, even with new signatures", () => {
  const g = loadGs({ key: KEY });
  const req = { type: "request", name: "Ana", email: "ana@cargo.example", rid: "rid-0123456789ab" };
  for (let i = 0; i < 4; i++) assert.deepEqual(g.doPost(sign(req, KEY)), { ok: true }, "try " + (i + 1));
  assert.equal(g.appended.length, 1, "one row in Access requests");
  assert.equal(g.mails.length, 1, "one email");
  for (let i = 0; i < 3; i++) g.doPost(sign({ ...usage, rid: "rid-usage-000001" }, KEY));
  assert.equal(g.appended.filter((a) => a.tab === "Usage").length, 1, "one Usage row");
  g.doPost(sign({ ...req, rid: "rid-other-000001" }, KEY));
  assert.equal(g.appended.length, 3, "a different rid is a new write");
  g.doPost(sign({ ...usage, rid: "bad id!" }, KEY));
  g.doPost(sign({ ...usage, rid: "bad id!" }, KEY));
  assert.equal(g.appended.length, 5, "a malformed rid is ignored, not trusted");
});
