// Unit tests for lib/sheet.ts and its agreement with the real Apps Script. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadGs } from "./gs-harness.mjs";

// each import gets its own copy of the module, so it reads the environment as set just before
const load = (tag: string) => import("../lib/sheet.ts" + "?" + tag) as Promise<typeof import("../lib/sheet.ts")>;
const KEY = "a-40-character-signing-key-for-tests-0001";

async function withFetch(handler: (url: string, body: string) => Response | Promise<Response>, fn: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => handler(String(url), String(init?.body))) as typeof fetch;
  try { await fn(); } finally { globalThis.fetch = real; }
}

test("the website's signed writes are accepted by the real Apps Script (valid key)", async () => {
  process.env.ADEYIQ_SHEET_URL = "https://example.test/exec";
  process.env.ADEYIQ_SHEET_KEY = KEY;
  const gs = loadGs({ key: KEY });
  const m = await load("valid");
  await withFetch((_u, body) => new Response(JSON.stringify(gs.doPost(body))), async () => {
    assert.equal(await m.toSheet({ type: "usage", event: "open", visitor: "v1" }), true);
    assert.equal(await m.toSheetRetry({ type: "request", name: "Ana", email: "ana@cargo.example" }), true);
  });
  assert.deepEqual(gs.appended.map((a: { tab: string }) => a.tab), ["Usage", "Access requests"]);
});

test("incorrect key: the Apps Script refuses and toSheet reports failure", async () => {
  process.env.ADEYIQ_SHEET_URL = "https://example.test/exec";
  process.env.ADEYIQ_SHEET_KEY = "b".repeat(40);
  const gs = loadGs({ key: KEY });
  const m = await load("wrong");
  await withFetch((_u, body) => new Response(JSON.stringify(gs.doPost(body))), async () => {
    assert.equal(await m.toSheet({ type: "usage", event: "open" }), false);
  });
  assert.equal(gs.appended.length, 0);
});

test("missing or short key on the website: nothing is sent at all (fail closed)", async () => {
  process.env.ADEYIQ_SHEET_URL = "https://example.test/exec";
  for (const [tag, key] of [["missing", undefined], ["short", "short"]] as const) {
    if (key === undefined) delete process.env.ADEYIQ_SHEET_KEY; else process.env.ADEYIQ_SHEET_KEY = key;
    const m = await load(tag);
    let calls = 0;
    await withFetch(() => { calls++; return new Response('{"ok":true}'); }, async () => {
      assert.equal(m.sheetReady(), false);
      assert.match(m.sheetProblem(), /ADEYIQ_SHEET_KEY/);
      assert.equal(await m.toSheet({ type: "usage" }), false);
    });
    assert.equal(calls, 0, `no request when the key is ${tag}`);
  }
});

test("the key is never in the URL or in the body in plain form; each try is signed again", async () => {
  process.env.ADEYIQ_SHEET_URL = "https://example.test/exec";
  process.env.ADEYIQ_SHEET_KEY = KEY;
  const m = await load("shape");
  const seen: { url: string; body: string }[] = [];
  await withFetch((url, body) => { seen.push({ url, body }); return new Response('{"ok":false}'); }, async () => {
    await m.toSheetRetry({ type: "usage" }, 2);
  });
  assert.equal(seen.length, 2);
  for (const s of seen) {
    assert.ok(!s.url.includes(KEY) && !s.body.includes(KEY));
    const env = JSON.parse(s.body);
    assert.deepEqual(Object.keys(env).sort(), ["nonce", "payload", "sig", "ts", "v"]);
  }
  assert.notEqual(JSON.parse(seen[0].body).nonce, JSON.parse(seen[1].body).nonce);
});

test("toSheet reports failure (false) instead of throwing when the sheet is down", async () => {
  process.env.ADEYIQ_SHEET_URL = "https://example.test/exec";
  process.env.ADEYIQ_SHEET_KEY = KEY;
  const m = await load("down");
  await withFetch(() => { throw new Error("network"); }, async () => assert.equal(await m.toSheet({ type: "usage" }), false));
  delete process.env.ADEYIQ_SHEET_URL;
  delete process.env.ADEYIQ_SHEET_KEY;
});

test("a saved write whose reply is lost is retried without a second row (found on the real test endpoint)", async () => {
  process.env.ADEYIQ_SHEET_URL = "https://example.test/exec";
  process.env.ADEYIQ_SHEET_KEY = KEY;
  const gs = loadGs({ key: KEY });
  const m = await load("lostreply");
  const rids = new Set<string>();
  let tries = 0;
  await withFetch((_u, body) => {
    tries++;
    rids.add(JSON.parse(JSON.parse(body).payload).rid);
    const r = gs.doPost(body); // the script saves the row...
    return tries < 3 ? new Response("gateway timeout", { status: 504 }) : new Response(JSON.stringify(r)); // ...but the first replies are lost
  }, async () => {
    assert.equal(await m.toSheetRetry({ type: "request", name: "Ana", email: "ana@cargo.example" }), true);
  });
  assert.equal(tries, 3);
  assert.equal(rids.size, 1, "every try carries the same request id");
  assert.equal(gs.appended.length, 1, "one row, not three");
  assert.equal(gs.mails.length, 1, "one email");
});
