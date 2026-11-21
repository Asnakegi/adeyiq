// End-to-end checks against a local production build, with a mock Google Sheet in place of the real one.
// Never points at production. Needs `npm run build` first and Google Chrome installed.
//   node test/e2e.mjs            (CHROME=/path/to/chrome to override)
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { loadGs } from "./gs-harness.mjs";

const APP = 5300, SHEET = 5301, CDP = 9340;
const BASE = `http://localhost:${APP}`;
const CHROME = process.env.CHROME || ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => fs.existsSync(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0;
const results = [];
const CI = !!process.env.GITHUB_ACTIONS;
// on GitHub Actions each failure is also an annotation, readable on the pull request without opening logs
const annotate = (msg) => { if (CI) console.log(`::error title=e2e::${String(msg).replace(/\r?\n/g, " ").slice(0, 900)}`); };
const check = (ok, msg) => { results.push([ok, msg]); console.log(`  ${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) { fails++; annotate("FAIL " + msg); } };

/* ---------- mock sheet: the REAL scripts/access-requests.gs, run with stand-in Google services ---------- */
const SHEET_KEY = "e2e-signing-key-" + "x".repeat(32);
const gs = loadGs({ key: SHEET_KEY });
const rows = [];
let sheetMode = "ok";
const sheet = http.createServer((req, res) => {
  let b = "";
  req.on("data", (c) => (b += c));
  req.on("end", () => {
    if (sheetMode === "fail") { res.writeHead(500); return res.end("down"); }
    const out = gs.doPost(b); // verifies signature, timestamp and nonce exactly as Apps Script will
    if (out.ok) { try { rows.push(JSON.parse(JSON.parse(b).payload)); } catch { rows.push({ bad: b }); } }
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(out));
  });
}).listen(SHEET);
const waitRow = async (pred, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const r = rows.find(pred); if (r) return r; await sleep(150); } return null; };

/* ---------- app ---------- */
const next = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(APP)], {
  // measurement requests use an in-memory store here, never a real one; all test browsers share one address, so allow more usage events per minute than a real visitor gets (60)
  env: { ...process.env, ADEYIQ_SHEET_URL: `http://127.0.0.1:${SHEET}/exec`, ADEYIQ_SHEET_KEY: SHEET_KEY, ADEYIQ_TRACK_PER_MIN: "600", ADEYIQ_MEASURE_STORE: "memory" }, stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
next.stdout.on("data", (d) => (serverLog += d));
next.stderr.on("data", (d) => (serverLog += d));
const prof = fs.mkdtempSync(path.join(os.tmpdir(), "adeyiq-e2e-"));
let chrome;
function done() { try { if (chrome) chrome.kill(); } catch {} next.kill(); sheet.close(); console.log(fails ? `\n${fails} FAILED of ${results.length}` : `\nAll ${results.length} end-to-end checks passed`); process.exit(fails ? 1 : 0); }
setTimeout(() => { console.log("TIMEOUT"); annotate(`timed out after ${results.length} checks; last: ${results.at(-1)?.[1] || "none"}`); fails++; done(); }, 480000);
for (const ev of ["uncaughtException", "unhandledRejection"])
  process.on(ev, (e) => { console.log(ev, e); annotate(`${ev} after ${results.length} checks: ${e?.stack || e}`); fails++; done(); });

for (let i = 0; i < 100; i++) { try { if ((await fetch(BASE + "/api/health")).ok) break; } catch {} await sleep(300); }

console.log("\nServer and headers");
const health = await (await fetch(BASE + "/api/health")).json();
check(health.ok && health.sheetConfigured === true, "/api/health reports ok and that the sheet is configured (without its URL)");
check(!JSON.stringify(health).includes("127.0.0.1"), "/api/health does not leak the sheet URL");
const home = await fetch(BASE + "/");
const csp = home.headers.get("content-security-policy") || "";
check(home.status === 200 && csp.includes("frame-ancestors 'self'") && home.headers.get("x-content-type-options") === "nosniff", "home page served with CSP and nosniff headers");
for (const p of ["/build", "/hold-view", "/aircraft-data", "/privacy", "/measure", "/dashboard"]) check((await fetch(BASE + p)).status === 200, `${p} returns 200`);
for (const p of ["/", "/build", "/adeyiq/xlsx-worker.js", "/vendor/sheetjs/0.20.3/xlsx.full.min.js"]) {
  const h = (await fetch(BASE + p)).headers.get("content-security-policy") || "";
  check(h && !/cdnjs|jsdelivr|unpkg/.test(h) && /worker-src 'self'/.test(h), `${p}: security policy allows no script CDN`);
}
check(/cdnjs.cloudflare.com/.test((await fetch(BASE + "/adeyiq_cargo_optimizer_v4.html")).headers.get("content-security-policy") || ""), "only the legacy optimizer demo may load from cdnjs");
for (const p of ["/", "/build", "/hold-view", "/aircraft-data", "/privacy", "/measure"]) {
  const s = ((await fetch(BASE + p)).headers.get("content-security-policy") || "").match(/script-src ([^;]*)/)?.[1] || "";
  check(!s.includes("unsafe-inline") && /'sha256-[A-Za-z0-9+/=]{44}'/.test(s), `${p}: inline scripts are allowed by hash, not by 'unsafe-inline'`);
}
{
  const v = await fetch(BASE + "/vendor/sheetjs/0.20.3/xlsx.full.min.js"), t = await v.text();
  const sha = (await import("node:crypto")).createHash("sha256").update(t).digest("hex");
  check(v.status === 200 && sha === "cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41", `self-hosted SheetJS 0.20.3 is served unchanged (sha256 ${sha.slice(0, 12)}…)`);
}
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
{
  // straight to the Apps Script, bypassing the website: unsigned, wrongly signed and replayed writes are refused
  const post = (b) => fetch(`http://127.0.0.1:${SHEET}/exec`, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());
  const n0 = rows.length, crypto = await import("node:crypto");
  const signed = (data, key) => { const ts = Date.now(), nonce = crypto.randomBytes(18).toString("base64url"), payload = JSON.stringify(data); return { v: 1, ts, nonce, payload, sig: crypto.createHmac("sha256", key).update(`${ts}.${nonce}.${payload}`).digest("base64") }; };
  const a = await post({ type: "usage", event: "open", visitor: "attacker" });
  const b = await post(signed({ type: "usage", event: "open", visitor: "attacker" }, "w".repeat(40)));
  const good = signed({ type: "usage", event: "open", visitor: "e2e-replay" }, SHEET_KEY);
  const c1 = await post(good), c2 = await post(good);
  check(!a.ok && !b.ok && c1.ok && !c2.ok && rows.length === n0 + 1, "Apps Script refuses unsigned, wrongly signed and replayed writes; a correctly signed one is accepted once");
}

/* ---------- browser ---------- */
// Ubuntu 24+ runners block the unprivileged namespaces Chrome's sandbox needs; the test only opens the local build
const chromeArgs = ["--headless=new", "--remote-debugging-port=" + CDP, "--user-data-dir=" + prof, "--no-first-run", ...(CI ? ["--no-sandbox"] : []), "about:blank"];
let chromeErr = "";
chrome = spawn(CHROME, chromeArgs, { stdio: ["ignore", "ignore", "pipe"] });
chrome.stderr.on("data", (d) => (chromeErr = (chromeErr + d).slice(-2000)));
chrome.on("error", (e) => (chromeErr += " spawn error: " + e.message));
let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) { try { const l = await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json(); wsUrl = l.find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {} await sleep(250); }
if (!wsUrl) { check(false, `Chrome did not start (${CHROME}): ${chromeErr.slice(-600)}`); done(); }
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
  // every request the browser makes, for the privacy checks (URL, body, headers)
  if (m.method === "Network.requestWillBeSent") netLog.push({ url: m.params.request.url, body: m.params.request.postData || "", headers: JSON.stringify(m.params.request.headers || {}) });
};
const netLog = [];
const send = (method, params = {}) => new Promise((res) => { const i = ++mid; pend.set(i, res); so.send(JSON.stringify({ id: i, method, params })); });
const js = async (expr) => { const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true, timeout: 30000 }); if (r.result?.exceptionDetails) throw new Error(expr.slice(0, 80) + ": " + r.result.exceptionDetails.exception?.description); return r.result?.result?.value; };
const until = async (expr, ms = 10000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(150); } return false; };
const go = async (u) => { await send("Page.navigate", { url: BASE + u }); await until("document.readyState==='complete'"); await sleep(400); };
await send("Runtime.enable"); await send("Page.enable"); await send("Log.enable"); await send("Network.enable", { maxPostDataSize: 65536 });
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

console.log("\nPrint and save: flight load plan and ULD build sheets");
// the cargo on board still includes the hostile CSV rows from above: printed names must stay text
const exp = await js(`(async()=>{let blob=null,name='';const oc=URL.createObjectURL;URL.createObjectURL=b=>{blob=b;return oc.call(URL,b)};const ac=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){name=this.download};
  document.getElementById('dlFlight').click();await new Promise(r=>setTimeout(r,400));HTMLAnchorElement.prototype.click=ac;URL.createObjectURL=oc;const html=blob?await blob.text():'';
  const d=new DOMParser().parseFromString(html,'text/html'),onAttr=[...d.querySelectorAll('*')].some(e=>[...e.attributes].some(a=>/^on/i.test(a.name)));
  const loaded=new Set([...document.querySelectorAll('#ulds .ulrow')].map(r=>r.innerText.split(' ')[0])).size;
  return {name,sheets:d.querySelectorAll('.sheet').length,svgs:d.querySelectorAll('.sheet svg').length,loaded,scripts:d.querySelectorAll('script').length,onAttr,img:!!d.querySelector('img[src="x"]'),
    hasPlan:/Flight load plan/.test(d.body.textContent),hasEvil:d.body.textContent.includes('<img src=x onerror'),xss:window.__xss}})()`);
check(/^adeyiq-load-plan-.+\.html$/.test(exp.name) && exp.hasPlan, `"⬇ HTML" saves the flight load plan (${exp.name})`);
check(exp.sheets === exp.loaded + 1 && exp.svgs >= exp.loaded, `load plan plus one build sheet with a 3D picture per loaded ULD (${exp.sheets} sheets, ${exp.loaded} ULDs)`);
check(exp.scripts === 0 && !exp.onAttr && !exp.img && exp.hasEvil && exp.xss === undefined, "cargo names with HTML/script are printed as text, never as code");
const pu = await js(`(async()=>{let doc=null;const o=window.open;window.open=()=>({document:{open(){},write(h){doc=h},close(){}},focus(){},print(){}});
  document.getElementById('back').click();await new Promise(r=>setTimeout(r,500));const c=document.querySelector('#strip .uchip');if(c)c.click();await new Promise(r=>setTimeout(r,300));
  document.getElementById('prtUld').click();await new Promise(r=>setTimeout(r,700));window.open=o;const d=new DOMParser().parseFromString(doc||'','text/html');
  return {sheets:d.querySelectorAll('.sheet').length,title:d.title,svg:!!d.querySelector('.sheet svg'),checks:/Built by/.test(d.body.textContent)}})()`);
check(pu.sheets === 1 && /build sheet/.test(pu.title) && pu.svg && pu.checks, `"Print ULD" makes one build sheet with the 3D picture and sign-off lines (${pu.title})`);
check(!!(await waitRow((r) => r.event === "download flight")) && !!(await waitRow((r) => r.event === "print uld")), "prints and downloads are counted");
// loose cargo (narrow-bodies) and DG quantities: the export must match what is actually on board
async function exportFor(acId, csv) {
  await go("/build");
  await js(`localStorage.clear()`);
  await go("/build");
  return js(`(async()=>{const s=document.getElementById('acSel');s.value=${JSON.stringify(acId)};s.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,400));
  const b0=document.getElementById('st1s').textContent;const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(csv)}],'x.csv'));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'));
  await new Promise(r=>{const iv=setInterval(()=>{if(document.getElementById('st1s').textContent!==b0){clearInterval(iv);r()}},30)});await new Promise(r=>setTimeout(r,500));
  document.getElementById('toLoad').click();await new Promise(r=>setTimeout(r,1200));
  let blob=null;const oc=URL.createObjectURL;URL.createObjectURL=b=>{blob=b;return oc.call(URL,b)};const ac=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};
  document.getElementById('dlFlight').click();await new Promise(r=>setTimeout(r,400));HTMLAnchorElement.prototype.click=ac;URL.createObjectURL=oc;
  const html=blob?await blob.text():'',d=new DOMParser().parseFromString(html,'text/html'),h2=[...d.querySelectorAll('h2')],tbl=t=>{const h=h2.find(x=>x.textContent.startsWith(t));return h?[...h.nextElementSibling.querySelectorAll('tbody tr')].map(r=>[...r.cells].map(c=>c.textContent.trim())):null};
  return {ok:!!blob,loose:tbl('Loose cargo'),notoc:tbl('Dangerous goods')}})()`);
}
const b738 = await exportFor("B737-800", "AWB,Goods,Pieces,Weight,L,W,H,DG,UN\n071-90000011,Spare parts,10,300,50,40,30,,\n071-90000022,Perfume,4,40,40,30,30,3,UN1266\n");
check(b738.ok && b738.loose && b738.loose.some((r) => r[1] === "071-90000022") && b738.notoc && b738.notoc[0][4] === "4", `737-800 (loose cargo only) can be printed: loose AWBs and their DG are in the plan (${JSON.stringify(b738.notoc)})`);
const bcf = await exportFor("B737-800BCF", "AWB,Goods,Pieces,Weight,L,W,H,DG,UN\n071-93000011,Lithium battery packs,52,20800,150,100,150,9,UN3481\n");
check(bcf.ok && bcf.notoc && bcf.notoc[0][4] === "44" && bcf.notoc[0][5] === "17,600", `NOTOC counts only the DG pieces loaded, not the booked total (${bcf.notoc && bcf.notoc[0].slice(4, 6).join(" pcs, ")} kg of 52 pcs booked)`);
await go("/build");
await js(`localStorage.clear()`);
await go("/build");
await js(`document.getElementById('sampleBtn').click()`);
await sleep(1500);
await js(`document.getElementById('toLoad').click()`);

await js(`(()=>{document.getElementById('rateBtn').click();document.querySelectorAll('#fbQs .scale').forEach(s=>s.querySelector('button:last-child').click());document.getElementById('fbC').value='e2e comment | with pipe';document.getElementById('fbSend').click();return true})()`);
const fb = await waitRow((r) => r.event === "feedback");
check(!!fb && /q1=\d.*\|q5=10\|role=.*\|c=e2e comment\s+\/\s+with pipe$/.test(fb.detail), "feedback reaches the sheet in the Feedback-tab format, pipes in comments neutralised" + (fb ? "" : " (no row)"));

console.log("\nMobile layout (375 px) and basic accessibility");
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
for (const p of ["/", "/build", "/hold-view", "/aircraft-data", "/privacy", "/measure"]) {
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

console.log("\nFull 777F charter, 300 pieces: 27 main + 10 lower positions full, 2 lower-deck pallets offloaded, in balance");
await go("/build");
await js(`localStorage.clear()`);
await go("/build");
// the 300-row booking used in the demo video: every piece its own dimensions (same generator, seed 4, 84 tall rows)
const charter = (() => {
  let s = 4;
  const R = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648), ri = (a, b) => Math.round(a + R() * (b - a));
  const TALL = ["Auto parts racks", "Machinery skids", "Furniture", "Solar panel pallets", "Garment racks", "Generator sets", "Industrial pumps", "Steel frames"];
  const LOW = ["Spare engine parts", "Medical supplies", "Electronics", "E-commerce parcels", "Textile cartons", "Tools", "Printed matter", "Ceramic tiles", "Coffee", "Leather goods", "Tyres", "Cables"];
  const rows = ["AWB,Goods,Pieces,Weight,L,W,H"];
  for (let i = 0; i < 300; i++) {
    const tall = i < 84, g = tall ? TALL[i % 8] : LOW[(i - 84) % 12], awb = "071-" + (55300000 + (tall ? i % 8 : 20 + ((i - 84) % 12)) * 11);
    const [l, w, h] = tall ? [ri(100, 200), ri(80, 150), ri(170, 230)] : [ri(155, 175), ri(45, 85), ri(45, 75)];
    rows.push([awb, g, 1, tall ? ri(700, 1100) : ri(50, 120), l, w, h].join(","));
  }
  return rows.join("\n") + "\n";
})();
const cr = await js(`(async()=>{const s=document.getElementById('acSel');s.value='B777F';s.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,400));
  const b0=document.getElementById('st1s').textContent;const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(charter)}],'charter.csv'));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'));
  await new Promise(r=>{const iv=setInterval(()=>{if(document.getElementById('st1s').textContent!==b0){clearInterval(iv);r()}},30)});await new Promise(r=>setTimeout(r,500));
  document.getElementById('toLoad').click();await new Promise(r=>setTimeout(r,1200));
  const rows=[...document.querySelectorAll('#ulds .ulrow')].map(b=>b.innerText.replace(/\\s+/g,' '));
  return {st2:document.getElementById('st2s').textContent,main:rows.filter(r=>/ Main [A-N][LRP] /.test(r)).length,lower:rows.filter(r=>/ (1\\d|3\\d)P /.test(r)).length,facts:document.getElementById('facts').textContent}})()`);
check(/main deck 27 pallet positions/.test(cr.facts) && /or 10 pallet positions/.test(cr.facts), `777F has 27 main-deck and 10 lower-deck pallet positions (${cr.facts.slice(0, 150)})`);
check(cr.main === 27 && cr.lower === 10, `all 37 positions used: 27 main deck, 10 lower deck (main ${cr.main}, lower ${cr.lower})`);
check(cr.st2 === "Balanced ✓ · 2 offloaded", `full freighter in balance, the 2 pallets without a position reported (${cr.st2})`);
// 20 ft PGA pallets need two rows side by side: balancing single pallets must not leave them without room
await go("/build");
await js(`localStorage.clear()`);
await go("/build");
const pga = "AWB,Goods,Pieces,Weight,L,W,H\n071-66100011,Machinery skids,12,30000,200,120,180\n" + Array.from({ length: 10 }, (_, i) => `071-6620000${i},Steel beams ${i},1,1000,500,200,100`).join("\n") + "\n";
const pr = await js(`(async()=>{const s=document.getElementById('acSel');s.value='B777F';s.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,400));
  const b0=document.getElementById('st1s').textContent;const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(pga)}],'pga.csv'));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'));
  await new Promise(r=>{const iv=setInterval(()=>{if(document.getElementById('st1s').textContent!==b0){clearInterval(iv);r()}},30)});await new Promise(r=>setTimeout(r,500));
  document.getElementById('toLoad').click();await new Promise(r=>setTimeout(r,1200));
  return {flag:document.getElementById('flagBtn').hidden,stats:document.getElementById('stats').innerText.replace(/\\s+/g,' ')}})()`);
check(pr.flag && /16 ULDs · 16 \//.test(pr.stats), `ten 20 ft pallets plus six main-deck pallets fill the 13 paired rows (${pr.stats})`);
// the 777F main deck ends in one centreline position: it takes one pallet only, keeps balance and DG segregation
async function load777(csv) {
  await go("/build");
  await js(`localStorage.clear()`);
  await go("/build");
  return js(`(async()=>{const s=document.getElementById('acSel');s.value='B777F';s.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,400));
  const b0=document.getElementById('st1s').textContent;const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(csv)}],'x.csv'));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'));
  await new Promise(r=>{const iv=setInterval(()=>{if(document.getElementById('st1s').textContent!==b0){clearInterval(iv);r()}},30)});await new Promise(r=>setTimeout(r,500));
  document.getElementById('toLoad').click();await new Promise(r=>setTimeout(r,1200));
  return {st2:document.getElementById('st2s').textContent,rows:[...document.querySelectorAll('#ulds .ulrow')].map(b=>b.innerText.replace(/\\s+/g,' '))}})()`);
}
const one = await load777("AWB,Goods,Pieces,Weight,L,W,H\n071-77200011,Heavy machine,1,5000,200,120,180\n");
check(one.st2 === "Balanced ✓" && !one.rows.some((r) => / Main NP /.test(r)), `one heavy pallet stays near the middle, not at the aft single position (${one.st2}; ${one.rows.join(" | ").slice(0, 80)})`);
const pga14 = await load777("AWB,Goods,Pieces,Weight,L,W,H\n" + Array.from({ length: 14 }, (_, i) => `071-772000${10 + i},Steel beam ${i},1,1000,500,200,100`).join("\n") + "\n");
check(pga14.st2 === "Balanced ✓ · 2 offloaded" && !pga14.rows.some((r) => / Main [MN][LRP] /.test(r) && /Steel/.test(r) && / Main N/.test(r)), `14 PGA: only 6 pairs fit (the last row takes one pallet), 2 offloaded (${pga14.st2})`);
const dgf = await load777("AWB,Goods,Pieces,Weight,L,W,H,DG\n071-77100011,Flammable liquids,52,52000,200,120,180,3\n071-77100022,Oxidizers,4,4000,200,120,180,5.1\n");
check(dgf.st2 === "Balanced ✓ · 2 offloaded" && !dgf.rows.some((r) => /Oxidizers/.test(r)), `oxidizers are not squeezed into the single position next to flammable liquids (${dgf.st2})`);
// heavy charter of low pieces (300 pieces, ~200 t, no AWB, all under 150 cm): built as lower-deck PMC pallets, which
// the main deck takes two abreast like main-deck pallets, so all 27 main-deck positions are used (not 14 rows of one)
const low = (() => {
  let s = 7;
  const R = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648), ri = (a, b) => Math.round(a + R() * (b - a));
  const rows = ["Goods,Pieces,Weight,L,W,H"];
  for (let i = 0; i < 300; i++) { const wt = ri(517, 817); rows.push([`Charter goods ${i}`, 1, wt, ri(105, 204), ri(78, 122), ri(62, 150)].join(",")); }
  return rows.join("\n") + "\n";
})();
const lc = await load777(low);
// the 777F default max payload (102 t placeholder) stops the load: heaviest ULDs first, the rest offloaded with the reason
const payState = () => js(`(()=>({st2:document.getElementById('st2s').textContent,rows:[...document.querySelectorAll('#ulds .ulrow')].map(b=>b.innerText.replace(/\\s+/g,' ')),
  pay:document.getElementById('payMax').value,reset:!document.getElementById('payReset').hidden,tr:(document.getElementById('payTr')||{}).innerText||'',alerts:document.getElementById('loadAlerts').innerText,
  saved:localStorage.getItem('adeyiq-payload')}))()`);
const kgOf = (tr) => Number((tr.match(/([\d,]+)\s+([\d,]+)\s*$/) || [])[1]?.replace(/,/g, "") || NaN);
const p0 = await payState();
check(p0.pay === "102000" && !p0.reset && kgOf(p0.tr) <= 102000 && kgOf(p0.tr) > 95000 && /max payload 102,000 kg of the Boeing 777 Freighter reached/i.test(p0.alerts) && /^Balanced ✓ · \d+ offloaded$/.test(lc.st2),
  `200 t charter on the 777F stops at the 102,000 kg default max payload (${p0.tr.replace(/\s+/g, " ")}; ${lc.st2})`);
// the user types a higher figure for tonight's flight: the slot model then fills all 27 main-deck positions two abreast
await js(`(async()=>{const i=document.getElementById('payMax');i.value='250000';i.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,800))})()`);
const p1 = await payState();
const lcMain = p1.rows.filter((r) => / Main [A-N][LRP] /.test(r)), lcPairs = p1.rows.filter((r) => / Main [A-M][LR] /.test(r)).length;
check(p1.pay === "250000" && p1.reset && /"B777F":250000/.test(p1.saved || "") && lcMain.length === 27 && lcPairs === 26 && p1.rows.filter((r) => / (1\d|3\d)P /.test(r)).length === 10 && /^Balanced ✓ · \d+ offloaded$/.test(p1.st2),
  `user max payload 250,000 kg (saved in this browser): 26 main-deck positions two abreast + the single last row, 10 lower deck, in balance (main ${lcMain.length}, paired ${lcPairs}; ${p1.st2})`);
await js(`(async()=>{document.getElementById('payReset').click();await new Promise(r=>setTimeout(r,800))})()`);
const p2 = await payState();
check(p2.pay === "102000" && !p2.reset && !/B777F/.test(p2.saved || "") && kgOf(p2.tr) <= 102000, `"Use default" goes back to the 102,000 kg placeholder (${p2.pay}, ${p2.tr.replace(/\s+/g, " ")})`);

// step 1 after an import: the not-loaded list stays closed behind one clear line (ULDs and tonnes), the recommended
// aircraft is shown and one click switches to it; the less frequent tools sit behind "More tools"
const rc = await js(`(async()=>{document.getElementById('st1').click();const s=document.getElementById('acSel');s.value='B787-9';s.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(r=>setTimeout(r,1500));
  const o={rec:document.getElementById('rec').innerText,flag:document.getElementById('flagBtn').textContent,open:!document.getElementById('flags').hidden,tools:document.getElementById('moreTools').hidden};
  document.getElementById('flagBtn').click();o.grp=document.getElementById('flags').innerText.replace(/\\s+/g,' ').slice(0,160);
  document.getElementById('recUse').click();await new Promise(r=>setTimeout(r,1500));o.after=document.getElementById('acSel').value;return o})()`);
check(/Recommended aircraft:\s*Boeing 777 Freighter/.test(rc.rec) && /2 flights/.test(rc.rec) && /^⚠ \d+ ULDs not loaded · [\d.]+ t left behind ▾$/.test(rc.flag) && !rc.open && rc.tools && /^\d+ ULDs · [\d.]+ t not loaded: max payload 20,000 kg of the Boeing 787-9 reached/.test(rc.grp) && rc.after === "B777F",
  `200 t on a 787-9: "${rc.flag}" (list closed until clicked: ${rc.grp.slice(0, 90)}…), recommends the 777F (2 flights), "Use" switches (${rc.after})`);

// by hand: open a not-loaded ULD from the list (its 3D build shows), load it, maximize a loaded one to its contour, undo
const hd = await js(`(async()=>{const w=t=>new Promise(r=>setTimeout(r,t)),$=id=>document.getElementById(id);await w(800);
  $('flags').hidden=false;const o=document.querySelector('#flags [data-open]');const id=o.dataset.open;o.click();await w(400);
  const r={id,info:$('info').innerText.replace(/\\s+/g,' ').slice(0,200),iso:$('iso').childElementCount};
  document.querySelector('#info [data-hact="on"]').click();await w(2500);r.after=$('info').innerText.replace(/\\s+/g,' ').slice(0,120);
  r.chipOff=!!document.querySelector('#strip [data-u="'+id+'"].off');r.hand=localStorage.getItem('adeyiq-hand');
  const m=document.querySelector('#info [data-hact="max"]');m.click();await w(2500);r.toast=$('toast').textContent;
  document.querySelector('#info [data-hact="reset"]').click();await w(2500);r.reset=localStorage.getItem('adeyiq-hand');return r})()`);
check(/not loaded/.test(hd.info) && /Load this ULD/.test(hd.info) && hd.iso > 0 && !hd.chipOff && /position [A-N]?\d*[LRP]/.test(hd.after) && /"B777F"/.test(hd.hand || "") && /(maximized|Nothing more fits)/.test(hd.toast) && (hd.reset === "{}" || hd.reset === null),
  `by hand: ${hd.id} opened from the not-loaded list (3D shown), loaded (${hd.after.slice(0, 60)}), maximize: "${hd.toast}", undo clears the hand changes`);

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

// The builder page does not load SheetJS (only its worker does). Test .xlsx files are made here in Node with the same
// self-hosted copy, never by injecting SheetJS into the page: that would define window.XLSX and hide page bugs.
const SHEETJS = (() => {
  const ctx = vm.createContext({ console });
  vm.runInContext(fs.readFileSync(new URL("../public/vendor/sheetjs/0.20.3/xlsx.full.min.js", import.meta.url), "utf8"), ctx);
  return ctx.XLSX;
})();
const xlsxB64 = (aoa, patch) => {
  const ws = SHEETJS.utils.aoa_to_sheet(aoa);
  if (patch) patch(ws);
  const wb = SHEETJS.utils.book_new();
  SHEETJS.utils.book_append_sheet(wb, ws, "S");
  return SHEETJS.write(wb, { type: "base64", bookType: "xlsx" });
};
console.log("\nPrivacy: cargo never leaves the browser (synthetic markers, every request watched)");
{
  // distinctive synthetic values that must never appear in any request or in anything forwarded to the sheet
  const MK = { awb: "999-77700011", awb2: "999-77700022", nat: "ZQXPRIVATECARGO", nat2: "ZQXXLSXCARGO", nat3: "ZQXMANUALCARGO", un: "UN3456", dims: "137x41x59", kg: "4321" };
  const net0 = netLog.length, rows0 = rows.length;
  await go("/build");
  await js(`localStorage.clear()`);
  await go("/build");
  const csv = `AWB,Goods,Pieces,Weight,L,W,H,DG,UN\n${MK.awb},${MK.nat},3,${MK.kg},137,41,59,8,${MK.un}\n`;
  const up = (name, content, isB64) => js(`(async()=>{const b0=document.getElementById('st1s').textContent;const c=${JSON.stringify(content)};const data=${isB64 ? "Uint8Array.from(atob(c),x=>x.charCodeAt(0))" : "c"};
    const dt=new DataTransfer();dt.items.add(new File([data],${JSON.stringify(name)}));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'));
    await new Promise(r=>{const t0=Date.now(),iv=setInterval(()=>{if(document.getElementById('st1s').textContent!==b0||Date.now()-t0>4000){clearInterval(iv);r()}},40)});await new Promise(r=>setTimeout(r,1300));return document.getElementById('toast').textContent})()`);
  await up("secret.csv", csv);
  // the same kind of data as a real .xlsx, read by the page exactly as a visitor's file would be
  check((await js(`typeof window.XLSX`)) === "undefined", "the builder page itself does not load SheetJS (Excel is read only in the worker)");
  await up("secret.xlsx", xlsxB64([["AWB", "Goods", "Pieces", "Weight", "L", "W", "H"], [MK.awb2, MK.nat2, 2, +MK.kg, 137, 41, 59]]), true);
  await js(`(async()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'))};if(document.getElementById('addPanel').hidden)document.getElementById('addToggle').click();
    s('sAwb','999-77700033');s('sNat',${JSON.stringify(MK.nat3)});s('sPcs','2');s('sWt','${MK.kg}');s('sL','137');s('sW','41');s('sH','59');document.getElementById('fSubmit').click();await new Promise(r=>setTimeout(r,1500))})()`);
  const n = await js(`JSON.parse(localStorage.getItem('adeyiq-ships')||'[]').length`);
  check(n === 3, `synthetic cargo from CSV, Excel and the form is in the builder (${n} shipments)`);
  await js(`(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const c=document.querySelector('#strip .uchip');if(c)c.click();await w(300);
    const o=window.open;window.open=()=>({document:{open(){},write(){},close(){}},focus(){},print(){}});document.getElementById('prtUld').click();await w(500);
    document.getElementById('toLoad').click();await w(1500);document.getElementById('prtFlight').click();await w(500);window.open=o;
    const oc=URL.createObjectURL;URL.createObjectURL=b=>oc.call(URL,b);const ac=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};document.getElementById('dlFlight').click();await w(500);HTMLAnchorElement.prototype.click=ac;URL.createObjectURL=oc;
    document.getElementById('reassign').click();await w(400);document.getElementById('back').click();await w(400);
    const s=document.getElementById('acSel');s.value='B777F';s.dispatchEvent(new Event('change',{bubbles:true}));await w(1500)})()`);
  await go("/build"); // refresh: cargo comes back from this browser's storage only
  const back = await js(`JSON.parse(localStorage.getItem('adeyiq-ships')||'[]').length`);
  await js(`(async()=>{document.getElementById('clearBtn').click();await new Promise(r=>setTimeout(r,1500))})()`);
  const cleared = await js(`(()=>{const v=localStorage.getItem('adeyiq-ships')||'[]';return {n:JSON.parse(v).length,hasMarker:Object.keys(localStorage).some(k=>/ZQX|999-777/.test(localStorage.getItem(k)||''))}})()`);
  check(back === 3 && cleared.n === 0 && !cleared.hasMarker, `cargo survives a refresh in this browser, and "Clear" removes it from storage (before ${back}, after ${cleared.n})`);
  await sleep(2500);
  const reqs = netLog.slice(net0), fwd = rows.slice(rows0).map((r) => JSON.stringify(r)).join("\n");
  const all = reqs.map((r) => r.url + " " + r.body + " " + r.headers).join("\n");
  const leaks = Object.values(MK).concat(["999-77700033"]).filter((v) => all.includes(v) || all.includes(encodeURIComponent(v)) || fwd.includes(v));
  check(leaks.length === 0, `no AWB, goods, UN number, weight or dimensions in any of ${reqs.length} browser requests or ${rows.length - rows0} forwarded rows${leaks.length ? " — found: " + leaks.join(", ") : ""}`);
  const hosts = [...new Set(reqs.map((r) => { try { return new URL(r.url).host; } catch { return r.url.slice(0, 20); } }))].sort();
  const allowed = ["localhost:" + APP, "fonts.googleapis.com", "fonts.gstatic.com"];
  check(hosts.every((h) => allowed.includes(h) || h === ""), `browser only talks to AdeyIQ and Google Fonts; the Excel reader is self-hosted (${hosts.join(", ")})`);
  const third = reqs.filter((r) => !r.url.startsWith(BASE) && !r.url.startsWith("data:") && !r.url.startsWith("blob:"));
  check(third.every((r) => r.body === "" && !/[?&](awb|q|data)=/.test(r.url)), `third-party requests carry no body and no query data (${third.length} requests, all font/script downloads)`);
  const details = rows.slice(rows0).filter((r) => r.type === "usage").map((r) => r.detail || "");
  check(details.every((d) => !/\d[\d,.]*\s*(kg|t)\b/i.test(d) && !/DG|NOTOC|PMC\d|AKE\d|→/.test(d)), `usage events carry no weights, DG details or ULD ids (${details.filter(Boolean).slice(0, 4).join(" | ")})`);
  const refs = rows.slice(rows0).filter((r) => r.ref).map((r) => r.ref);
  check(refs.every((r) => !/[/?#][^/]/.test(r.replace(/^[a-z-]+:\/\/[^/]+/, ""))), `the referrer is sent as a site address only (${[...new Set(refs)].join(", ") || "none"})`);
  const page = await (await fetch(BASE + "/build")).text();
  check(!page.includes("1-jMbYE7sy6ikGYviHWyP2L") && !/script\.google\.com\/macros/.test(page), "no spreadsheet ID or Apps Script URL in the public builder page");
}

console.log("\nHostile manifests (synthetic)");
{
  await go("/build");
  await js(`localStorage.clear()`);
  await go("/build");
  const up = (name, content, isB64) => js(`(async()=>{const c=${JSON.stringify(content)};const data=${isB64 ? "Uint8Array.from(atob(c),x=>x.charCodeAt(0))" : "c"};
    document.getElementById('toast').textContent='';const dt=new DataTransfer();dt.items.add(new File([data],${JSON.stringify(name)}));const f=document.getElementById('file');f.files=dt.files;const t0=performance.now();f.dispatchEvent(new Event('change'));
    await new Promise(r=>{const t1=Date.now(),iv=setInterval(()=>{if(document.getElementById('toast').textContent||Date.now()-t1>20000){clearInterval(iv);r()}},50)});await new Promise(r=>setTimeout(r,300));return {toast:document.getElementById('toast').textContent,n:JSON.parse(localStorage.getItem('adeyiq-ships')||'[]').length,ms:Math.round(performance.now()-t0)}})()`);
  const net0 = netLog.length;
  const f1 = await up("formula.csv", `AWB,Goods,Pieces,Weight,L,W,H\n071-11112222,"=HYPERLINK(""http://evil.test/x"",""click"")",1,10,50,40,30\n071-11113333,"=WEBSERVICE(""http://evil.test/y"")",1,10,50,40,30\n071-11114444,@SUM(1+1)*cmd|' /C calc'!A0,1,10,50,40,30\n`);
  check(f1.n === 3 && (await js(`document.getElementById('cargo').textContent.includes('=HYPERLINK(')`)) && !netLog.slice(net0).some((r) => r.url.includes("evil.test")), "spreadsheet formulas in cells stay plain text and never trigger a request");
  const xf = xlsxB64([["AWB", "Goods", "Pieces", "Weight", "L", "W", "H"], ["071-22223333", "x", 1, 10, 50, 40, 30]], (ws) => {
    ws.B2 = { t: "s", v: "cached", f: 'HYPERLINK("http://evil.test/z","x")' };
  });
  await up("formula.xlsx", xf, true);
  check(!netLog.slice(net0).some((r) => r.url.includes("evil.test")), "an Excel formula cell is read as its stored value and never fetches anything");
  const f2 = await up("broken.xlsx", Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 8, 0]), Buffer.alloc(300, 0x41)]).toString("base64"), true);
  check(/could not be read|took too long/.test(f2.toast) && (await js(`1+1`)) === 2, `a damaged .xlsx (which hangs the Excel reader) no longer freezes the page and shows a message ("${f2.toast}")`);
  const f3 = await up("notes.exe", "MZ\u0000\u0000binary");
  check(/CSV or Excel/.test(f3.toast), `unexpected file types are refused ("${f3.toast}")`);
  const f4 = await up("fake.csv", "PK\u0003\u0004\u0000\u0000\u0000binary\u0000data");
  check(/not a text CSV/.test(f4.toast), `a binary file renamed .csv is refused ("${f4.toast}")`);
  const big = "AWB,Goods,Pieces,Weight,L,W,H\n" + Array.from({ length: 5002 }, (_, i) => `071-${String(30000000 + i)},Box,1,10,50,40,30`).join("\n");
  const f5 = await up("huge.csv", big);
  check(/more than 5,000 lines/.test(f5.toast), `manifests over 5,000 lines are refused ("${f5.toast}")`);
  const f6 = await up("bomb.csv", "AWB,Goods,Pieces,Weight,L,W,H\n071-44445555,Box,999999999,10,50,40,30\n071-44446666,Box,2,999999999,50,40,30\n071-44447777,Box,2,10,99999,40,30\n");
  check(f6.ms < 4000 && /3 skipped/.test(f6.toast), `absurd pieces, weights and sizes are skipped and the page stays responsive (${f6.ms} ms, "${f6.toast}")`);
  const before = await js(`JSON.parse(localStorage.getItem('adeyiq-ships')||'[]').length`);
  await up("proto.csv", `__proto__,constructor,prototype,AWB,Goods,Pieces,Weight,L,W,H\n{"polluted":1},x,y,071-55556666,Box,1,10,50,40,30\n`);
  check((await js(`({}).polluted===undefined&&Object.prototype.polluted===undefined`)) && (await js(`JSON.parse(localStorage.getItem('adeyiq-ships')||'[]').length`)) === before + 1, "__proto__ / constructor columns do not pollute JavaScript objects");
  const uni = "‮gnp.exe‭ ​zero‍width 𝐁𝐎𝐋𝐃 ☢️ 中文 العربية <b>x</b>";
  await up("unicode.csv", `AWB,Goods,Pieces,Weight,L,W,H\n071-66667777,${uni},1,10,50,40,30\n`);
  check((await js(`document.getElementById('cargo').textContent.includes('<b>x</b>')&&!document.querySelector('#cargo b')`)), "Unicode controls, emoji and mixed scripts are shown as text, and HTML inside them stays text");
  const html = await js(`(async()=>{let blob=null;const oc=URL.createObjectURL;URL.createObjectURL=b=>{blob=b;return oc.call(URL,b)};const ac=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){};
    document.getElementById('toLoad').click();await new Promise(r=>setTimeout(r,1200));document.getElementById('dlFlight').click();await new Promise(r=>setTimeout(r,500));HTMLAnchorElement.prototype.click=ac;URL.createObjectURL=oc;return blob?await blob.text():''})()`);
  const d = html.replace(/<style[\s\S]*?<\/style>/, "");
  check(html.length > 0 && !/<script|\son[a-z]+=|javascript:/i.test(d) && d.includes("&lt;b&gt;x&lt;/b&gt;"), "the HTML export contains no script, event handlers or javascript: links from cargo text");
}

console.log("\nMessy real-world manifests (synthetic samples in test/fixtures/manifests)");
{
  const FIX = new URL("./fixtures/manifests/", import.meta.url);
  const shipsNow = () => js(`JSON.parse(localStorage.getItem('adeyiq-ships')||'[]').map(s=>[s.awb,s.pcs,s.wt,s.l+'x'+s.w+'x'+s.h])`);
  const up = async (name, content, isB64) => {
    await js(`localStorage.clear()`);
    await go("/build");
    return js(`(async()=>{const c=${JSON.stringify(content)};const data=${isB64 ? "Uint8Array.from(atob(c),x=>x.charCodeAt(0))" : "c"};
    document.getElementById('toast').textContent='';const dt=new DataTransfer();dt.items.add(new File([data],${JSON.stringify(name)}));const f=document.getElementById('file');f.files=dt.files;f.dispatchEvent(new Event('change'));
    await new Promise(r=>{const t1=Date.now(),iv=setInterval(()=>{if(document.getElementById('toast').textContent||Date.now()-t1>20000){clearInterval(iv);r()}},50)});await new Promise(r=>setTimeout(r,300));
    const s=document.getElementById('upSum');return {toast:document.getElementById('toast').textContent,sum:s.hidden?'':s.textContent}})()`);
  };
  const a = await up("title-rows-semicolon.csv", fs.readFileSync(new URL("title-rows-semicolon.csv", FIX), "utf8"));
  const sa = await shipsNow();
  check(sa.length === 6 && JSON.stringify(sa[0]) === JSON.stringify(["071-10000011", 4, 1234.5, "120x80x60"]) && /6 shipments added/.test(a.toast),
    `a CSV with title rows above the header, ";" separators and "1.234,5" weights imports (${sa.length} lines, first ${JSON.stringify(sa[0])})`);
  check(/Header found on row 4/.test(a.sum) && /Weight ← “Gross Wt \(kg\)”/.test(a.sum) && /Chargeable weight.*not gross weight/.test(a.sum) && /total line/.test(a.sum),
    `the import summary names the columns used, the ignored chargeable weight and the skipped total line ("${a.sum.slice(0, 160)}…")`);
  // the Excel sample with merged AWB cells and a two-row header, made here in Node (never in the page)
  const merged = xlsxB64(JSON.parse(fs.readFileSync(new URL("merged-awb.json", FIX), "utf8")), (ws) => { ws["!merges"] = ["A6:A7", "D6:D7", "H6:H7", "E4:G4"].map((r) => SHEETJS.utils.decode_range(r)); });
  const b = await up("merged-awb.xlsx", merged, true);
  const sb = await shipsNow();
  check(sb.length === 5 && sb.filter((s) => s[0] === "071-50000011").reduce((n, s) => n + s[2], 0) === 900 && /5 shipments added/.test(b.toast),
    `an Excel load list with merged AWB cells and "Dimensions (cm)" over L / W / H imports, weight shared by volume (${JSON.stringify(sb.slice(0, 2))})`);
  check(/shared by volume/.test(b.sum) && (await js(`typeof window.XLSX`)) === "undefined", "the summary states the weight-sharing rule, and the page still does not load SheetJS");
  const c = await up("no-header.csv", fs.readFileSync(new URL("no-header.csv", FIX), "utf8"));
  check((await shipsNow()).length === 3 && /No header row found/.test(c.sum) && /guessed/.test(c.sum), `a file without a header row is read by guessing the columns, and the summary says so`);
  const d = await up("multi.csv", `AWB,Pcs,Weight,Dims,Goods\n071-70000011,3,600,"2/120x80x60, 1/60x40x40",Parts\n`);
  const sd = await shipsNow();
  check(sd.length === 2 && sd[0][1] === 2 && sd[1][1] === 1 && Math.round((sd[0][2] + sd[1][2]) * 10) === 6000 && /2 shipments added/.test(d.toast), `"2/120x80x60, 1/60x40x40" becomes two lines with 2 and 1 pieces (${JSON.stringify(sd)})`);
  // the downloadable template: the button points at a real file, and a filled template imports
  const tpl = await js(`(async()=>{const a=document.getElementById('tplBtn'),c=document.getElementById('tplCsv');const r=await fetch(a.href),t=await fetch(c.href);return {x:r.status,xs:(await r.arrayBuffer()).byteLength,xd:a.getAttribute('download'),c:t.status,head:(await t.text()).split(/\\r?\\n/)[0]}})()`);
  check(tpl.x === 200 && tpl.xs > 1000 && tpl.xd === "adeyiq-cargo-template.xlsx" && tpl.c === 200 && /Weight kg \(total\) \*/.test(tpl.head), `the "Cargo template" button downloads the Excel template, and the CSV link the same columns (${tpl.xs} bytes)`);
  const tb = SHEETJS.read(fs.readFileSync(new URL("../public/adeyiq/adeyiq-cargo-template.xlsx", import.meta.url)), { type: "buffer" });
  const exRows = SHEETJS.utils.sheet_to_json(tb.Sheets.Example, { header: 1, raw: false, defval: "" });
  const filled = SHEETJS.utils.sheet_to_json(tb.Sheets.Cargo, { header: 1, raw: false, defval: "" }).concat(exRows.slice(2));
  const t = await up("my-cargo.xlsx", xlsxB64(filled), true);
  const st = await shipsNow();
  check(st.length === 5 && /5 shipments added/.test(t.toast) && JSON.stringify(st[1]) === JSON.stringify(["071-12345686", 10, 180, "40x30x30"]), `a filled-in cargo template imports every line (${st.length} lines, "${t.toast}")`);
  await up("hostile-header.csv",`AWB,"<img src=x onerror=window.__xss=9> Weight",Dims,"<b>Goods</b>"\n071-70000022,10,50x40x30,Box\n`);
  check((await js(`window.__xss===undefined&&!document.querySelector('#upSum img')&&![...document.querySelectorAll('#upSum b')].some(b=>b.textContent==='Goods')&&document.getElementById('upSum').textContent.includes('<img src=x')`)), "header text from the file is shown as text in the import summary, never as HTML");
}

console.log("\nMeasurement requests: planner → phone → review → apply (local in-memory store, synthetic data)");
{
  const err0 = pageErrors.length, net0 = netLog.length;
  const health2 = await (await fetch(BASE + "/api/health")).json();
  check(health2.measureStore === "memory", `the local run uses the in-memory request store, never a real one (${health2.measureStore})`);
  const mapi = (body, h = {}) => fetch(BASE + "/api/measure", { method: "POST", body: JSON.stringify(body), headers: { origin: BASE, "x-forwarded-for": "10.77.0.2", ...h } });
  check((await mapi({ op: "create", awb: "A", piece: "P" }, { origin: "https://evil.example" })).status === 403, "cross-site POST to /api/measure is refused (403)");
  const mp = await fetch(BASE + "/measure");
  const mcsp = mp.headers.get("content-security-policy") || "";
  check(mp.status === 200 && /'sha256-/.test(mcsp) && !/script-src[^;]*unsafe-inline/.test(mcsp) && /noindex/.test(await mp.text()), "/measure is served with hashed inline scripts and is not indexed");

  // planner: a three-piece line, 120×80×75 cm
  await go("/build");
  await js(`localStorage.clear()`);
  await go("/build");
  const setF = (pairs) => js(`(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'))};if(document.getElementById('addPanel').hidden)document.getElementById('addToggle').click();${pairs.map(([k, v]) => `s('${k}',${JSON.stringify(v)});`).join("")}})()`);
  await setF([["sAwb", "071-55500011"], ["sNat", "E2E measured crate"], ["sPcs", "3"], ["sWt", "300"], ["sL", "120"], ["sW", "80"], ["sH", "75"]]);
  await js(`document.getElementById('fSubmit').click()`);
  await until(`JSON.parse(localStorage.getItem('adeyiq-ships')||'[]').length===1`);
  const lineId = await js(`JSON.parse(localStorage.getItem('adeyiq-ships'))[0].id`);
  await js(`(()=>{if(document.getElementById('listPanel').hidden)document.getElementById('listToggle').click();document.querySelector('[data-msr="${lineId}"]').click()})()`);
  const dlg = await js(`({open:document.getElementById('msrDlg').open,awb:document.getElementById('mAwb').value,piece:document.getElementById('mPiece').value,p:['mpL','mpW','mpH'].map(i=>document.getElementById(i).value).join('x')})`);
  check(dlg.open && dlg.awb === "071-55500011" && dlg.piece === "Piece 1 of 3" && dlg.p === "120x80x75", `"📏" on a cargo line opens a request for one piece with AWB, piece reference and planned size (${JSON.stringify(dlg)})`);
  await js(`document.getElementById('mPiece').value='Piece 2 of 3';document.getElementById('mGo').click()`);
  check(await until(`!document.getElementById('msrShare').hidden&&document.getElementById('shUrl').value.includes('/measure#t=')`), "creating the request shows the link to share");
  const link = await js(`document.getElementById('shUrl').value`);
  const share = await js(`(async()=>{document.getElementById('shQr').click();await new Promise(r=>setTimeout(r,200));const m=document.getElementById('shMail').getAttribute('href');
    return {qr:!!document.querySelector('#shQrBox svg path'),mailto:m.startsWith('mailto:?subject='),mailHasLink:decodeURIComponent(m).includes(${JSON.stringify(link)})}})()`);
  check(share.qr && share.mailto && share.mailHasLink, "Show QR code draws the code in the page; Open email draft is a mailto: link (nothing is sent) with the same link");
  const tok = new URL(link).hash.match(/t=([^&]+)/)[1];
  check(/^[A-Za-z0-9_-]{22}$/.test(tok) && !netLog.slice(net0).some((r) => r.url.includes(tok)), "the link token is 128 random bits in the URL fragment and never appears in a request URL");
  check(netLog.slice(net0).every((r) => r.url.startsWith(BASE) || r.url.startsWith("data:") || r.url.startsWith("blob:") || /fonts\.(googleapis|gstatic)\.com|_vercel/.test(r.url)), "making the request and its QR code talks only to AdeyIQ (no outside QR service)");
  await js(`document.getElementById('shDone').click()`);

  // phone: a fresh visit to the link on a 375 px screen (the phone page keeps nothing in browser storage)
  await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
  await go(link.replace(/^https?:\/\/[^/]+/, ""));
  check(await until(`!document.getElementById('open').hidden`), "the phone page opens the request");
  const ph = await js(`({t:document.getElementById('open').innerText,sw:document.documentElement.scrollWidth})`);
  check(ph.t.includes("071-55500011") && ph.t.includes("Piece 2 of 3") && ph.t.includes("120 × 80 × 75") && /maximum outside size/.test(ph.t) && /pallet or skid/.test(ph.t) && ph.sw <= 376, "phone page identifies the piece and says to measure the maximum outside size incl. protrusions, wrapping and skid; fits 375 px");
  await js(`document.getElementById('mTape').click();document.getElementById('send').click()`);
  check(await js(`/length, width, height/.test(document.getElementById('err').textContent)&&document.getElementById('vL').getAttribute('aria-invalid')==='true'`), "sending without three sizes is refused on the phone");
  await js(`(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'))};s('vL','132');s('vW','-80');document.getElementById('send').click()})()`);
  check(await js(`document.getElementById('vW').getAttribute('aria-invalid')==='true'&&!document.getElementById('open').hidden`), "a negative size is refused");
  // camera estimate for the height: a synthetic photo with a 100 cm reference of 500 px and an edge of 388 px → 77.6 → 78 cm
  const est = await js(`(async()=>{document.getElementById('mCam').click();document.querySelector('[data-cam="h"]').click();const r=document.getElementById('refLen');r.value='100';r.dispatchEvent(new Event('input'));
    const c=document.createElement('canvas');c.width=1000;c.height=700;const x=c.getContext('2d');x.fillStyle='#888';x.fillRect(0,0,1000,700);x.fillStyle='#a63';x.fillRect(100,100,388,388);x.fillStyle='#ff0';x.fillRect(100,595,500,10);
    const blob=await new Promise(z=>c.toBlob(z,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'e2e.png',{type:'image/png'}));const f=document.getElementById('photo');f.files=dt.files;f.dispatchEvent(new Event('change'));
    await new Promise(z=>setTimeout(z,600));const cv=document.getElementById('cv'),b=cv.getBoundingClientRect();const tap=(px,py)=>cv.dispatchEvent(new PointerEvent('pointerdown',{clientX:b.left+px*b.width/cv.width,clientY:b.top+py*b.height/cv.height,bubbles:true}));
    tap(100,600);tap(600,600);tap(100,100);await new Promise(z=>setTimeout(z,50));const partial=document.getElementById('estBox').hidden;tap(100,488);await new Promise(z=>setTimeout(z,50));
    const e=document.getElementById('est').textContent;document.getElementById('undo').click();tap(100,488);const again=document.getElementById('est').textContent,dir=document.getElementById('estWarn').textContent;document.getElementById('useEst').click();
    return {partial,e,again,dir:/different directions/.test(dir),h:document.getElementById('vH').value,how:document.getElementById('hH').textContent,file:f.files.length}})()`);
  check(est.partial && est.dir && est.e === "≈ 78 cm" && est.again === est.e && est.h === "78" && est.how === "Photo estimate", `camera mode: reference length + four taps give an estimate, labelled as such, with undo/retake, warning when reference and edge point different ways (${JSON.stringify(est)})`);
  await js(`(()=>{document.getElementById('camClose').click();const e=document.getElementById('vW');e.value='80';e.dispatchEvent(new Event('input'));document.getElementById('note').value='E2E skid included';document.getElementById('send').click()})()`);
  check(await until(`!document.getElementById('done').hidden`), "valid sizes are sent");
  const done = await js(`document.getElementById('done').innerText`);
  check(/Length\s+132 cm\s+Tape/.test(done) && /Height\s+78 cm\s+Photo estimate/.test(done), "the phone confirms the sizes and how each was measured");
  const sub = netLog.slice(net0).filter((r) => r.url === BASE + "/api/measure" && r.body.includes('"submit"'));
  check(sub.length === 1 && !/image|base64|blob/.test(sub[0].body) && sub[0].body.length < 400, `only numbers, methods and the note are sent, never the photo (${sub[0] && sub[0].body.length} bytes)`);
  const resend = await mapi({ op: "submit", token: tok, l: 1, w: 1, h: 1, method: { l: "tape", w: "tape", h: "tape" } });
  check(resend.status === 409, "the link can submit only once");
  await send("Emulation.clearDeviceMetricsOverride");

  // planner again: the result arrives from the server (another device), the plan is unchanged until applied
  await go("/build");
  await js(`(()=>{if(document.getElementById('msrPanel').hidden)document.getElementById('msrToggle').click();document.getElementById('msrCheck').click()})()`);
  check(await until(`/Measured/.test(document.querySelector('.msr')?.innerText||'')`), "the planner sees the measurement sent from the phone");
  const rev = await js(`(()=>{const c=document.querySelector('.msr');const row=a=>c.querySelector('tr[data-ax="'+a+'"]');return {d:['l','w','h'].map(a=>row(a).querySelector('td.d').textContent.replace(/\\s*larger/,'')),big:['l','w','h'].map(a=>row(a).classList.contains('big')),flag:c.classList.contains('mflag'),
    st:c.querySelector('.st').textContent,how:row('h').innerText,note:c.innerText.includes('E2E skid included'),ships:JSON.parse(localStorage.getItem('adeyiq-ships')).map(s=>[s.pcs,s.wt,s.l,s.w,s.h])}})()`);
  check(JSON.stringify(rev.d) === '["+12","0","+3"]' && JSON.stringify(rev.big) === "[true,false,true]" && rev.flag && /larger than planned/.test(rev.st), `planned 120×80×75 vs measured 132×80×78 shows +12, 0, +3 and flags the piece (${JSON.stringify(rev.d)})`);
  check(/photo estimate/.test(rev.how) && rev.note, "the review shows how each size was measured and the note");
  check(JSON.stringify(rev.ships) === "[[3,300,120,80,75]]", "receiving a result does not change the plan");
  await js(`document.querySelector('[data-mapply]').click()`);
  check(await until(`JSON.parse(localStorage.getItem('adeyiq-ships')).length===2`), "Apply changes the plan");
  const ap = await js(`({ships:JSON.parse(localStorage.getItem('adeyiq-ships')).map(s=>[s.awb,s.pcs,s.wt,s.l+'x'+s.w+'x'+s.h,s.mref]),card:document.querySelector('.msr').innerText,uld:document.getElementById('st1s').textContent})`);
  check(JSON.stringify(ap.ships) === JSON.stringify([["071-55500011", 2, 200, "120x80x75", ""], ["071-55500011", 1, 100, "132x80x78", "Piece 2 of 3"]]), `only the measured piece changes: split into its own line, pieces and weight totals kept (${JSON.stringify(ap.ships)})`);
  check(/Applied/.test(ap.card) && /Build-up rerun/.test(ap.card) && /ULD/.test(ap.uld), "the build-up is rerun and the result says where the piece went");
  let gone404 = false;
  for (let i = 0; i < 30 && !gone404; i++) { gone404 = (await mapi({ op: "view", token: tok })).status === 404; if (!gone404) await sleep(100); }
  check(gone404, "once applied, the server copy is deleted");
  await go(link.replace(/^https?:\/\/[^/]+/, ""));
  check(await until(`!document.getElementById('gone').hidden&&/not valid/.test(document.getElementById('goneT').textContent)`), "the used link no longer opens the request");

  // expired links: on the phone, and in the planner list
  const exp36 = Math.floor((Date.now() - 60000) / 1000).toString(36);
  await go(`/measure#t=${"Q".repeat(22)}&e=${exp36}`);
  check(await until(`!document.getElementById('gone').hidden&&document.getElementById('goneT').textContent==='This link has expired'`), "an expired link says so on the phone and asks for a new one");
  await go("/build");
  await js(`(()=>{const a=JSON.parse(localStorage.getItem('adeyiq-measure'));a.push({token:'${"Z".repeat(22)}',key:'k',awb:'071-55500099',piece:'Piece 1 of 1',planned:{l:50,w:50,h:50},shipId:null,draft:null,created:Date.now()-7200000,expires:Date.now()-3600000,status:'open',result:null});localStorage.setItem('adeyiq-measure',JSON.stringify(a))})()`);
  await go("/build");
  await js(`(()=>{if(document.getElementById('msrPanel').hidden)document.getElementById('msrToggle').click();document.getElementById('msrCheck').click()})()`);
  check(await until(`[...document.querySelectorAll('.msr')].some(c=>c.innerText.includes('071-55500099')&&/Link expired, nothing received/.test(c.innerText)&&!c.querySelector('[data-mshare]'))`), "an expired request shows as expired in the planner, with no link to share");

  // missing dimensions: the add form offers a request; the result is added as cargo only when the planner adds it
  await js(`document.getElementById('msrPanel').querySelector('[data-close]').click()`);
  await setF([["sAwb", "071-55500022"], ["sNat", "E2E no dims"], ["sPcs", "1"], ["sWt", "40"], ["sL", ""], ["sW", ""], ["sH", ""]]);
  await js(`document.getElementById('fSubmit').click()`);
  check(await js(`!document.getElementById('sMsr').hidden&&/length, width and height/i.test(document.getElementById('sErr').textContent)`), "missing dimensions stop the cargo and offer “Request measurement”");
  await js(`document.getElementById('sMsrBtn').click()`);
  const md = await js(`({awb:document.getElementById('mAwb').value,piece:document.getElementById('mPiece').value,p:['mpL','mpW','mpH'].map(i=>document.getElementById(i).value).join('|')})`);
  check(md.awb === "071-55500022" && md.piece === "Piece 1 of 1" && md.p === "||", `the request takes the AWB and piece reference and keeps missing sizes missing (${JSON.stringify(md)})`);
  await js(`document.getElementById('mGo').click()`);
  await until(`!document.getElementById('msrShare').hidden`);
  const link2 = await js(`document.getElementById('shUrl').value`);
  await js(`document.getElementById('shDone').click()`);
  const tok2 = new URL(link2).hash.match(/t=([^&]+)/)[1];
  // a different device, straight to the API: the planner's browser has no part in the submission
  const other = await mapi({ op: "submit", token: tok2, l: 60, w: 40, h: 35, method: { l: "tape", w: "tape", h: "tape" } }, { "x-forwarded-for": "10.88.0.9", "user-agent": "Mozilla/5.0 (Linux; Android 14) Mobile" });
  check(other.status === 200, "a submission from another device is accepted");
  check((await js(`JSON.parse(localStorage.getItem('adeyiq-ships')).length`)) === 2, "the piece without dimensions was not added");
  await js(`(()=>{if(document.getElementById('msrPanel').hidden)document.getElementById('msrToggle').click();document.getElementById('msrCheck').click()})()`);
  check(await until(`(document.querySelector('[data-mtok="${tok2}"]')?.innerText||'').split('No planned dimension').length===4`), "with no planned size the review shows “No planned dimension” and no difference");
  await js(`document.querySelector('[data-madd="${tok2}"]').click()`);
  const form = await js(`['sAwb','sL','sW','sH','sWt'].map(i=>document.getElementById(i).value).join('|')`);
  check(form === "071-55500022|60|40|35|40", `“Add as cargo” fills the form with the measured size (${form})`);
  await js(`document.getElementById('fSubmit').click()`);
  check(await until(`JSON.parse(localStorage.getItem('adeyiq-ships')).some(s=>s.awb==='071-55500022'&&s.l===60&&s.mref==='Piece 1 of 1')`), "the planner adds it, marked as measured");
  check(await until(`/Applied/.test(document.querySelector('[data-mtok="${tok2}"]')?.innerText||'')`), "and the request shows as applied");

  // a line edited after the request: the measured piece can't be matched, so nothing is changed
  const ln3 = await js(`JSON.parse(localStorage.getItem('adeyiq-ships')).find(s=>s.pcs===2).id`);
  await js(`document.querySelector('[data-msr="${ln3}"]').click()`);
  await js(`document.getElementById('mGo').click()`);
  await until(`!document.getElementById('msrShare').hidden`);
  const tok3 = new URL(await js(`document.getElementById('shUrl').value`)).hash.match(/t=([^&]+)/)[1];
  await js(`document.getElementById('shDone').click()`);
  await js(`document.querySelector('[data-edit="${ln3}"]').click()`);
  await setF([["sH", "90"]]);
  await js(`document.getElementById('fSubmit').click()`);
  await mapi({ op: "submit", token: tok3, l: 121, w: 80, h: 91, method: { l: "tape", w: "tape", h: "tape" } });
  await js(`document.getElementById('msrCheck').click()`);
  check(await until(`(()=>{const c=document.querySelector('[data-mtok="${tok3}"]');return !!c&&/Can’t apply automatically/.test(c.innerText)&&/changed after the request/.test(c.innerText)&&!c.querySelector('[data-mapply]')})()`), "when the line was edited after the request, applying is blocked with the reason");
  check((await js(`JSON.parse(localStorage.getItem('adeyiq-ships')).find(s=>s.id==='${ln3}').h`)) === 90, "and the line is left as the planner edited it");
  // a 404 from /api/measure is the expected answer for the expired, used and removed links opened on purpose above
  const errs = pageErrors.slice(err0).filter((e) => !/favicon|_vercel\/insights/.test(e) && !/status of 404.*\/api\/measure/.test(e));
  check(errs.length === 0, `no page errors in the measurement flow${errs.length ? ": " + errs.slice(0, 3).join(" || ") : ""}`);
}

console.log("\nAPI: methods and error replies");
for (const [p, m] of [["/api/track", "PUT"], ["/api/track", "DELETE"], ["/api/request", "GET"], ["/api/health", "POST"]]) {
  const r = await fetch(BASE + p, { method: m, headers: { origin: BASE } });
  check(r.status === 405, `${m} ${p} is refused (${r.status})`);
}
{
  const r = await fetch(BASE + "/api/request", { method: "POST", headers: { origin: BASE, "x-forwarded-for": "8.8.4.4" }, body: "{not json" });
  const t = await r.text();
  check(r.status === 400 && !/at |Error|stack|\.ts|\.js/.test(t), `a malformed request gets a short error with no internals (${r.status} ${t.slice(0, 40)})`);
}

console.log("\nRate limit (last, uses up this client's quota)");
let codes = [];
for (let i = 0; i < 7; i++) codes.push((await fetch(BASE + "/api/request", { method: "POST", headers: { origin: BASE }, body: JSON.stringify({ name: "RL", email: "rl@example.test" }) })).status);
check(codes.includes(429), `access requests are rate limited per client: ${codes.join(",")}`);
done();
