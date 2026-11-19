// Unit tests for lib/sheet.ts: the optional shared secret is added to every write. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";

// each import gets its own copy of the module, so it reads the environment as set just before
const load = (tag: string) => import("../lib/sheet.ts" + "?" + tag) as Promise<typeof import("../lib/sheet.ts")>;

test("toSheet sends the shared secret when ADEYIQ_SHEET_KEY is set, and nothing extra when it is not", async () => {
  const sent: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => { sent.push(String(init?.body)); return new Response('{"ok":true}', { status: 200 }); }) as typeof fetch;
  try {
    process.env.ADEYIQ_SHEET_URL = "https://example.test/exec";
    process.env.ADEYIQ_SHEET_KEY = "k-test-123";
    const withKey = await load("with-key");
    assert.equal(await withKey.toSheet({ type: "usage", event: "open" }), true);
    assert.deepEqual(JSON.parse(sent[0]), { type: "usage", event: "open", key: "k-test-123" });

    delete process.env.ADEYIQ_SHEET_KEY;
    const noKey = await load("no-key");
    await noKey.toSheet({ type: "usage", event: "open" });
    assert.equal("key" in JSON.parse(sent[1]), false);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.ADEYIQ_SHEET_URL;
    delete process.env.ADEYIQ_SHEET_KEY;
  }
});

test("toSheet reports failure (false) instead of throwing when the sheet is down or answers not ok", async () => {
  const realFetch = globalThis.fetch;
  process.env.ADEYIQ_SHEET_URL = "https://example.test/exec";
  try {
    const m = await load("down");
    globalThis.fetch = (async () => { throw new Error("network"); }) as typeof fetch;
    assert.equal(await m.toSheet({ type: "usage" }), false);
    globalThis.fetch = (async () => new Response('{"ok":false}', { status: 200 })) as typeof fetch;
    assert.equal(await m.toSheet({ type: "usage" }), false);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.ADEYIQ_SHEET_URL;
  }
});
