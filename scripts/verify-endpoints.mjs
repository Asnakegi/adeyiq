// Checks every HTTP endpoint of AdeyIQ with a valid request and with invalid ones, and fails on any unexpected status
// or any 5xx that is not the documented "sheet not configured / sheet down" answer.
//
//   node scripts/verify-endpoints.mjs                      (default http://localhost:3000)
//   node scripts/verify-endpoints.mjs http://localhost:5343
//
// Writes (POST) are sent only to a local server (localhost / 127.0.0.1), never to the live site, so the owner's Google
// Sheet is never touched. For a full run, start the site against a local stand-in sheet, as test/e2e.mjs does.
// For any other address only the read-only GET checks run.
const BASE = (process.argv[2] || process.env.BASE || "http://localhost:3000").replace(/\/$/, "");
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE);
const ORIGIN = new URL(BASE).origin;
const results = [];
let ip = 0;

async function call(method, path, { body, headers = {}, origin = ORIGIN } = {}) {
  const h = { "x-forwarded-for": `198.51.100.${(++ip % 250) + 1}`, ...headers };
  if (method !== "GET" && origin) h.origin = origin;
  const r = await fetch(BASE + path, { method, headers: h, body, redirect: "manual" });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: r.status, type: r.headers.get("content-type") || "", csp: r.headers.get("content-security-policy") || "", text, json };
}
function check(group, name, ok, info) {
  results.push({ group, name, ok: !!ok, info });
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${group} · ${name}${ok ? "" : "  → " + info}`);
}
const json = (o) => JSON.stringify(o);

console.log(`Checking ${BASE} (${LOCAL ? "local: GET and POST checks" : "not local: GET checks only"})\n`);

/* ---------- pages and static files (GET) ---------- */
const pages = ["/", "/build", "/hold-view", "/aircraft-data", "/privacy", "/dashboard", "/flights", "/shipments", "/uld", "/3dview", "/planning", "/dg", "/reports", "/settings", "/optimizer"];
for (const p of pages) {
  const r = await call("GET", p);
  check("Pages", `GET ${p} → 200 HTML with a security policy`, r.status === 200 && /text\/html/.test(r.type) && !!r.csp, `${r.status} ${r.type}`);
}
const files = [
  ["/adeyiq/un-list.json", /json/], ["/adeyiq/adeyiq-cargo-template.csv", /csv|text/], ["/adeyiq/adeyiq-cargo-template.xlsx", /sheet|octet|zip/],
  ["/adeyiq/help.js", /javascript/], ["/adeyiq/track.js", /javascript/], ["/adeyiq/xlsx-worker.js", /javascript/],
  ["/vendor/sheetjs/0.20.3/xlsx.full.min.js", /javascript/], ["/adeyiq_cargo_optimizer_v3.html", /html/], ["/adeyiq_cargo_optimizer_v4.html", /html/],
];
for (const [p, t] of files) {
  const r = await call("GET", p);
  check("Static files", `GET ${p} → 200`, r.status === 200 && t.test(r.type), `${r.status} ${r.type}`);
}
{
  const r = await call("GET", "/adeyiq/un-list.json");
  check("Static files", "un-list.json has a source and over 2,000 UN numbers", r.json && r.json.n > 2000 && r.json.src, r.text.slice(0, 80));
  const n = await call("GET", "/no-such-page");
  check("Pages", "GET an unknown path → 404, not 500", n.status === 404, String(n.status));
}

/* ---------- GET /api/health ---------- */
{
  const r = await call("GET", "/api/health");
  check("/api/health", "GET → 200 {ok, sheetConfigured, time}", r.status === 200 && r.json && r.json.ok === true && typeof r.json.sheetConfigured === "boolean" && !isNaN(Date.parse(r.json.time)), `${r.status} ${r.text}`);
  check("/api/health", "never shows the sheet URL or key", !/script\.google|exec|key/i.test(r.text.replace(/sheetConfigured/, "")), r.text);
  const p = await call("POST", "/api/health", { body: "{}" });
  check("/api/health", "POST → 405 (read only)", p.status === 405, String(p.status));
}

if (LOCAL) {
  const health = (await call("GET", "/api/health")).json || {};
  const sheet = health.sheetConfigured === true;

  /* ---------- POST /api/track ---------- */
  const ev = { event: "open", page: "/verify", visitor: "verify-endpoints", session: "s1", aircraft: "B787-9", detail: "endpoint check", w: 1280 };
  const T = (b, o) => call("POST", "/api/track", { body: typeof b === "string" ? b : json(b), ...o });
  let r = await T(ev);
  check("/api/track", "valid usage event → 204", r.status === 204, String(r.status));
  r = await T({ ...ev, event: "feedback", detail: "q1=4|q2=5|q3=4|q4=5|q5=4|role=Load control|c=ok" });
  check("/api/track", "valid feedback event → 204", r.status === 204, String(r.status));
  r = await T({ ...ev, event: "drop table" });
  check("/api/track", "unknown event → 400", r.status === 400, String(r.status));
  r = await T({ page: "/x" });
  check("/api/track", "missing event → 400", r.status === 400, String(r.status));
  r = await T("not json");
  check("/api/track", "body that is not JSON → 400", r.status === 400, String(r.status));
  r = await T("[1,2]");
  check("/api/track", "JSON that is not an object → 400", r.status === 400, String(r.status));
  r = await T({ ...ev, detail: "x".repeat(5000) });
  check("/api/track", "body over 4 KB → 413", r.status === 413, String(r.status));
  r = await T(ev, { origin: "https://evil.example" });
  check("/api/track", "post from another site → 403", r.status === 403, String(r.status));
  r = await T(ev, { origin: "" });
  check("/api/track", "post without Origin → 403", r.status === 403, String(r.status));
  r = await T(ev, { headers: { "user-agent": "Googlebot/2.1" } });
  check("/api/track", "bot user agent → 204 and nothing recorded", r.status === 204, String(r.status));
  r = await call("GET", "/api/track");
  check("/api/track", "GET → 405", r.status === 405, String(r.status));

  /* ---------- POST /api/request ---------- */
  const req = { name: "Endpoint Check", email: "endpoint-check@example.test", company: "AdeyIQ test", phone: "", modules: ["Optimize revenue"], message: "Automated endpoint check. Ignore." };
  const Q = (b, o) => call("POST", "/api/request", { body: typeof b === "string" ? b : json(b), ...o });
  r = await Q(req);
  if (sheet) check("/api/request", "valid access request → 200 {ok:true}", r.status === 200 && r.json && r.json.ok === true, `${r.status} ${r.text}`);
  else check("/api/request", "valid request without a sheet → 503 {ok:false,error:'not set up'} (documented)", r.status === 503 && r.json && r.json.ok === false, `${r.status} ${r.text}`);
  if (sheet) {
    r = await Q({ ...req, email: "" });
    check("/api/request", "missing email → 400 with a message", r.status === 400 && r.json && r.json.ok === false && !!r.json.error, `${r.status} ${r.text}`);
    r = await Q({ ...req, email: "not-an-email" });
    check("/api/request", "invalid email → 400", r.status === 400, String(r.status));
    r = await Q({ ...req, name: "   " });
    check("/api/request", "missing name → 400", r.status === 400, String(r.status));
    r = await Q({ ...req, website: "http://spam.example" });
    check("/api/request", "honeypot filled (bot) → 200 but not saved", r.status === 200 && r.json && r.json.ok === true, `${r.status} ${r.text}`);
    r = await Q("not json");
    check("/api/request", "body that is not JSON → 400", r.status === 400, String(r.status));
    r = await Q({ ...req, message: "x".repeat(9000) });
    check("/api/request", "body over 8 KB → 413", r.status === 413, String(r.status));
    r = await Q(req, { origin: "https://evil.example" });
    check("/api/request", "post from another site → 403", r.status === 403, String(r.status));
  }
  r = await call("GET", "/api/request");
  check("/api/request", "GET → 405", r.status === 405, String(r.status));
}

const fails = results.filter((x) => !x.ok);
console.log(`\n${fails.length ? fails.length + " FAILED of " + results.length : "All " + results.length + " endpoint checks passed"}`);
process.exit(fails.length ? 1 : 0);
