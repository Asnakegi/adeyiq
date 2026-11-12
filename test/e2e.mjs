// End-to-end checks against a local production build, with a mock Google Sheet in place of the real one.
// Never points at production. Needs `npm run build` first and Google Chrome installed.
//   node test/e2e.mjs            (CHROME=/path/to/chrome to override)
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const APP = 5300, SHEET = 5301, CDP = 9340;
const BASE = `http://localhost:${APP}`;
const CHROME = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const results = [];
const check = (ok, msg) => { results.push([ok, msg]); console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) fails++; };

/* ---------- mock sheet (stands in for the Apps Script web app) ---------- */
const rows = [];
let sheetMode = "ok";
const sheet = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    if (sheetMode === "fail") { res.writeHead(500); return res.end("down"); }
    try { rows.push(JSON.parse(b)); } catch { rows.push({ bad: b }); }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"ok":true}');
  });
}).listen(SHEET);
const waitRow = async (pred, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const r = rows.find(pred); if (r) return r; await sleep(150); } return null; };

/* ---------- app ---------- */
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(APP)], {
  env: { ...process.env, ADEYIQ_SHEET_URL: `http://127.0.0.1:${SHEET}/exec` }, stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
next.stdout.on("data", (d) => (serverLog += d));
next.stderr.on("data", (d) => (serverLog += d));
const prof = fs.mkdtempSync(path.join(os.tmpdir(), "adeyiq-e2e-"));
let chrome;
function done() { try { if (chrome) chrome.kill(); } catch {} next.kill(); sheet.close(); console.log(fails ? `\n${fails} FAILED of ${results.length}` : `\nAll ${results.length} end-to-end checks passed`); process.exit(fails ? 1 : 0); }
setTimeout(() => { console.log("TIMEOUT"); fails++; done(); }, 240000);

for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await sleep(300); }

console.log("\nServer and headers");
const health = await (await fetch(BASE + "/api/health")).json();
check(health.ok && health.sheetConfigured === true, "/api/health reports ok and that the sheet is configured (without its URL)");
check(!JSON.stringify(health).includes("127.0.0.1"), "/api/health does not leak the sheet URL");
const home = await fetch(BASE + "/");
const csp = home.headers.get("content-security-policy") || "";
check(home.status === 200 && csp.includes("frame-ancestors 'self'") && home.headers.get("x-content-type-options") === "nosniff", "home page served with CSP and nosniff headers");
for (const p of ["/build", "/hold-view", "/aircraft-data", "/privacy", "/dashboard"]) check((await fetch(BASE + p)).status === 200, `${p} returns 200`);
const dash = await (await fetch(BASE + "/dashboard")).text();
check(dash.includes("noindex") && dash.includes("invented sample data"), "demo dashboard is marked noindex and labelled as sample data");

console.log("\nAPI abuse protection (HTTP)");
const ev = (o, h = {}) => fetch(BASE + "/api/track", { method: "POST", body: JSON.stringify(o), headers: { origin: BASE, ...h } });
check((await ev({ event: "open" }, { origin: "https://evil.example" })).status === 403, "cross-site POST to /api/track is refused (403)");
check((await fetch(BASE + "/api/request", { method: "POST", body: JSON.stringify({ name: "x", email: "x@y.zz" }) })).status === 403, "POST to /api/request without Origin is refused (403)");
await ev({ event: "open", visitor: "e2e-bot" }, { "user-agent": "Mozilla/5.0 HeadlessChrome/120" });
check((await ev({ event: "rm -rf" })).status === 400, "unknown event rejected (400)");
check((await ev({ event: "open", detail: "x".repeat(5000) })).status === 413, "oversized body rejected (413)");
check((await ev({ event: "open", page: "/e2e-http", visitor: "e2e-http" })).status === 204, "valid same-origin event accepted (204)");
check(!!(await waitRow((r) => r.visitor === "e2e-http")), "accepted event reaches the sheet");
check(!rows.some((r) => r.visitor === "e2e-bot"), "events from headless or bot browsers are not written");

/* ---------- browser ---------- */
chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=" + CDP, "--user-data-dir=" + prof, "--no-first-run", "about:blank"], { stdio: "ignore" });
let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) { try { const l = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); wsUrl = l.find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {} await sleep(250); }
const so = new WebSocket(wsUrl);
await new Promise((r) => (so.onopen = r));
let mid = 0;
const pend = new Map(), pageErrors = [];
so.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") pageErrors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === "Log.entryAdded" && m.params.entry.level === "error") pageErrors.push(m.params.entry.text + " " + (m.params.entry.url || ""));
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") pageErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
};
const send = (method, params = {}) => new Promise((res) => { const i = ++mid; pend.set(i, res); so.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, timeout: 30000 }); if (r.result?.exceptionDetails) throw new Error(expr.slice(0, 80) + ": " + r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
const until = async (expr, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(150); } return false; };
const go = async (u) => { await send("Page.navigate", { url: BASE + u }); await until("document.readyState==='complete'"); await sleep(400); };
await send("Runtime.enable"); await send("Page.enable"); await send("Log.enable");
// headless Chrome names itself "HeadlessChrome", which the server drops as a bot (checked separately below); present as normal Chrome
const realUA = (await send("Browser.getVersion")).result.userAgent.replace("HeadlessChrome", "Chrome");
await send("Emulation.setUserAgentOverride", { userAgent: realUA });

console.log("\nHome page: access request");
await go("/");
check(!!(await waitRow((r) => r.event === "open" && r.page === "/")), "page open is counted through sendBeacon (passes the origin check)");
const fill = `(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'))};document.getElementById('access').hidden=false;document.getElementById('m2').checked=true;s('fName','E2E Tester');s('fEmail','e2e@example.test');s('fCompany','<b>Co</b>');document.getElementById('fSend').click();return true})()`;
await js(`(()=>{document.getElementById('access').hidden=false;document.getElementById('fSend').click()})()`);
check(await js(`document.getElementById('eName').textContent.length>0&&document.getElementById('eEmail').textContent.length>0`), "empty form shows name and email errors and sends nothing");
await js(fill);
check(await until(`document.body.innerText.includes('Request sent.')`), "valid request shows 'Request sent.'");
const reqRow = await waitRow((r) => r.type === "request" && r.email === "e2e@example.test");
check(!!reqRow && reqRow.company === "<b>Co</b>", "request row reaches the sheet with fields intact");
check(!(await js(`!!document.querySelector('#formBox b b')`)), "company HTML is shown as text, not markup");
sheetMode = "fail";
await go("/");
await js(fill);
check(await until(`document.body.innerText.includes('ready to send')`, 30000), "when the sheet is down the form offers a copy-and-send fallback instead of losing the request");
check(serverLog.includes("[request] access request could not be written"), "server logs the failed write");
sheetMode = "ok";

console.log("\nCargo Builder");
await go("/build");
await js(`localStorage.clear()`);
await go("/build");
await js(`document.getElementById('sampleBtn').click()`);
check(await until(`/ULD/.test(document.getElementById('st1s').textContent)`), "sample cargo builds ULDs");
check(await until(`document.querySelectorAll('#iso g[data-i], #iso polygon, #iso path').length>0`), "3D view draws the build");
const nShips = () => js(`JSON.parse(localStorage.getItem('adeyiq-ships')||'[]').length`);
const before = await nShips();
await js(`(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'))};s('sAwb','071-12345675');s('sNat','E2E crate');s('sPcs','3');s('sWt','90');s('sL','60');s('sW','40');s('sH','40');document.getElementById('fSubmit').click()})()`);
check(await until(`JSON.parse(localStorage.getItem('adeyiq-ships')||'[]').length===${before + 1}`), "adding a shipment saves it on this device");
check(await js(`document.getElementById('saved').textContent.includes('this device')`), "save label says the cargo is saved on this device");
const idE = await js(`JSON.parse(localStorage.getItem('adeyiq-ships')).find(s=>s.awb.includes('12345675')).id`);
await js(`document.querySelector('[data-edit="${idE}"]').click()`);
await js(`(()=>{const e=document.getElementById('sPcs');e.value='5';e.dispatchEvent(new Event('input'));document.getElementById('fSubmit').click()})()`);
check(await until(`JSON.parse(localStorage.getItem('adeyiq-ships')).find(s=>s.id==='${idE}')?.pcs==5`), "editing a shipment updates it");
await js(`document.querySelector('[data-del="${idE}"]').click()`);
check(await until(`!JSON.parse(localStorage.getItem('adeyiq-ships')).some(s=>s.id==='${idE}')`), "removing a shipment deletes it");

const evil = `AWB,Goods,Pieces,Weight,L,W,H\n071-11111111,"<img src=x onerror=window.__xss=1>",2,40,50,40,30\n071-22222222,<script>window.__xss=2</script>,1,20,40,30,30\n"<svg onload=window.__xss=3>",Text,1,10,30,30,30\n`;
await js(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(evil)}],'evil.csv',{type:'text/csv'}));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'));return true})()`);
await sleep(2500);
check(await js(`window.__xss===undefined && !document.querySelector('img[src="x"]') && !document.querySelector('#cargo svg[onload], #cargo script')`), "CSV with HTML/script payloads is shown as text and never runs");
check(await js(`document.getElementById('cargo').textContent.includes('<img src=x onerror')&&document.getElementById('cargo').textContent.includes('<script>window.__xss=2')`), "the uploaded text is still visible to the user (escaped, not dropped)");
check(!!(await waitRow((r) => r.event === "upload file")), "upload is counted");

await js(`document.getElementById('toLoad').click()`);
check(await until(`!document.getElementById('p2')||!document.getElementById('p2').hidden`), "Load to aircraft opens the hold view");
check(!!(await waitRow((r) => r.event === "load aircraft")), "load aircraft is counted");

await js(`(()=>{document.getElementById('rateBtn').click();document.querySelectorAll('#fbQs .scale').forEach(s=>s.querySelector('button:last-child').click());document.getElementById('fbC').value='e2e comment | with pipe';document.getElementById('fbSend').click();return true})()`);
const fb = await waitRow((r) => r.event === "feedback");
check(!!fb && /q1=\d.*\|q5=10\|role=.*\|c=e2e comment\s+\/\s+with pipe$/.test(fb.detail), "feedback reaches the sheet in the Feedback-tab format, pipes in comments neutralised" + (fb ? "" : " (no row)"));

console.log("\nMobile layout (375 px) and basic accessibility");
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
for (const p of ["/", "/build", "/hold-view", "/aircraft-data", "/privacy"]) {
  await go(p);
  const sw = await js(`document.documentElement.scrollWidth`);
  check(sw <= 376, `${p}: no horizontal scroll at 375 px (page width ${sw})`);
  const a11y = await js(`(()=>{const lab=e=>e.labels&&e.labels.length||e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.title||e.type==='hidden'||e.getAttribute('aria-hidden')==='true'||e.hidden;
    const inputs=[...document.querySelectorAll('input,select,textarea')].filter(e=>!lab(e)).map(e=>e.id||e.name);
    const imgs=[...document.querySelectorAll('img')].filter(i=>!i.hasAttribute('alt')).length;
    const btns=[...document.querySelectorAll('button')].filter(b=>!(b.textContent.trim()||b.getAttribute('aria-label')||b.title)).map(b=>b.id||b.className);
    return {lang:document.documentElement.lang,inputs,imgs,btns,h1:document.querySelectorAll('h1').length}})()`);
  check(a11y.lang === "en" && a11y.h1 >= 1, `${p}: page language set and has a main heading`);
  check(!a11y.inputs.length && !a11y.imgs && !a11y.btns.length, `${p}: form fields labelled, images have alt, buttons named${a11y.inputs.length || a11y.btns.length ? " — missing: " + JSON.stringify(a11y) : ""}`);
}
await send("Emulation.clearDeviceMetricsOverride");

console.log("\nLocal performance (production build, this machine)");
for (const p of ["/", "/build"]) {
  await go(p);
  const t = await js(`(()=>{const n=performance.getEntriesByType('navigation')[0];return {load:Math.round(n.loadEventEnd),bytes:performance.getEntriesByType('resource').reduce((s,r)=>s+(r.transferSize||0),n.transferSize||0)}})()`);
  check(t.load < 3000, `${p}: loads in ${t.load} ms, ${Math.round(t.bytes / 1024)} KB transferred`);
}
await go("/build");
await js(`localStorage.clear()`);
await go("/build");
const t100 = await js(`new Promise(res=>{let rows=['AWB,Goods,Pieces,Weight,L,W,H'];const d=[[60,40,40],[50,40,30],[40,30,30],[80,60,50],[100,60,60],[120,80,60]];for(let i=0;i<100;i++){const x=d[i%d.length],p=5+((i*7)%40);rows.push('071-'+(88000000+i)+',Goods '+i+','+p+','+p*12+','+x.join(','))}
  const t0=performance.now(),b0=document.getElementById('st1s').textContent;const dt=new DataTransfer();dt.items.add(new File([rows.join('\\n')+'\\n'],'c.csv'));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'));
  const iv=setInterval(()=>{if(document.getElementById('st1s').textContent!==b0){clearInterval(iv);res(Math.round(performance.now()-t0))}},20)})`);
check(t100 < 6000, `100-shipment upload builds in ${t100} ms`);

console.log("\nPage errors and CSP");
// expected locally: Vercel Analytics exists only on Vercel; the 502 is the deliberate sheet-down test above
const expected = (e) => /favicon|_vercel\/insights|\/api\/request/.test(e);
console.log("  (ignored, expected locally: " + pageErrors.filter(expected).length + " Vercel Analytics / deliberate 502 entries)");
const relevant = pageErrors.filter((e) => !expected(e));
check(!relevant.some((e) => /Content Security Policy|Refused to/.test(e)), "no Content-Security-Policy violations" + (relevant.length ? "" : ""));
check(relevant.length === 0, `no uncaught page errors${relevant.length ? ": " + relevant.slice(0, 5).join(" || ") : ""}`);

console.log("\nRate limit (last, uses up this client's quota)");
let codes = [];
for (let i = 0; i < 7; i++) codes.push((await fetch(BASE + "/api/request", { method: "POST", headers: { origin: BASE }, body: JSON.stringify({ name: "RL", email: "rl@example.test" }) })).status);
check(codes.includes(429), `access requests are rate limited per client: ${codes.join(",")}`);
done();
