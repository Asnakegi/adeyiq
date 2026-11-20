// Checks a DEPLOYED Apps Script web app end to end with real signed requests (run by the owner, not in CI).
// Point it at the TEST endpoint first. It writes exactly one Usage row (visitor "owner-verify"), which Clean usage
// already ignores, and then confirms that unsigned, wrongly signed, replayed and stale requests are refused.
//
//   PowerShell:  $env:SHEET_URL="https://script.google.com/macros/s/…/exec"; $env:SHEET_KEY="…"; node scripts/verify-sheet-endpoint.mjs
//   bash:        SHEET_URL=… SHEET_KEY=… node scripts/verify-sheet-endpoint.mjs
//
// The key is read from the environment only and is never printed. The URL is printed shortened.
import { createHmac, randomBytes } from "node:crypto";

const url = process.env.SHEET_URL || "", key = process.env.SHEET_KEY || "";
// SHEET_ALLOW_LOCAL=1 lets the repo test this script against a local stand-in running the real .gs file
const localOk = process.env.SHEET_ALLOW_LOCAL === "1" && /^http:\/\/127\.0\.0\.1:\d+\/exec$/.test(url);
if (!localOk && !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) { console.error("Set SHEET_URL to the web app URL ending in /exec"); process.exit(2); }
if (key.length < 32) { console.error("Set SHEET_KEY to the signing key (at least 32 characters)"); process.exit(2); }
const shortUrl = url.replace(/\/s\/([\w-]{6})[\w-]+\//, "/s/$1…/");

const sign = (data, k = key, ts = Date.now(), nonce = randomBytes(18).toString("base64url")) => {
  const payload = JSON.stringify(data);
  return { v: 1, ts, nonce, payload, sig: createHmac("sha256", k).update(`${ts}.${nonce}.${payload}`).digest("base64") };
};
const post = async (body) => {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow" });
  const text = await r.text();
  try { return { status: r.status, ...JSON.parse(text) }; } catch { return { status: r.status, ok: undefined, raw: text.slice(0, 80) }; }
};

const row = { type: "usage", event: "verify", page: "/verify", visitor: "owner-verify", detail: "signed endpoint check " + new Date().toISOString() };
const good = sign(row);
const checks = [
  ["signed request is accepted (one row written)", () => post(good), (r) => r.ok === true],
  ["the same request again is refused (replay)", () => post(good), (r) => r.ok === false],
  ["unsigned request is refused", () => post({ ...row, detail: "unsigned" }), (r) => r.ok === false],
  ["request signed with a wrong key is refused", () => post(sign({ ...row, detail: "wrong key" }, randomBytes(30).toString("base64"))), (r) => r.ok === false],
  ["request older than 5 minutes is refused", () => post(sign({ ...row, detail: "stale" }, key, Date.now() - 6 * 60 * 1000)), (r) => r.ok === false],
];

console.log(`Checking ${shortUrl}`);
let failed = 0;
for (const [name, run, pass] of checks) {
  const r = await run().catch((e) => ({ error: e.message }));
  const ok = pass(r);
  if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  → " + JSON.stringify(r)}`);
}
console.log(failed ? `\n${failed} check(s) failed. If the first one failed, the key or the deployment is wrong; see Apps Script → Executions.` :
  "\nAll checks passed. Now look in the sheet's Usage tab for one row with visitor owner-verify, then delete it if you like.");
process.exit(failed ? 1 : 0);
