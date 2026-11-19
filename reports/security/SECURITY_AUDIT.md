# AdeyIQ security audit

**Date:** 19 November 2026 · **Auditor:** Claude (AI), at the owner's request
**Code audited:** `Asnakegi/adeyiq` `main` at `f15e531`; fixes on branch `security-audit` (not merged, not deployed)
**Also inspected:** the owner's local claude.ai artifact copies (`adeyiq-builder.html`, `adeyiq-modules.html`) and the
live site's public response headers (read-only GET requests only).

> **Revision 2 (19 Nov 2026):** the owner's review found that the first-pass Apps Script fix was syntactically
> invalid and that no test covered it. See `REMEDIATION_REPORT.md` for the corrected design, the tests that were
> missing, and the current status. Statuses below are updated; superseded statements are marked.

## Executive summary

- **Website (adeyiq.vercel.app):** cargo manifests do **not** leave the browser. This was verified in code and by
  watching every browser request while using synthetic cargo (CSV, Excel and the form; build, load, print, export,
  refresh, clear). No AWB, goods, dimensions, weights, DG class or UN number reached AdeyIQ's servers, the Google Sheet
  or any third party.
- **But the analytics did carry cargo-derived totals** (total kg, tonnes, "DG · NOTOC", ULD ids and positions).
  **Fixed** on the security branch.
- **The claude.ai artifact copies of the pages are the biggest risk:** they send full shipment rows to the Google
  Sheet and keep them in an artifact database shared by every viewer. **High.** Not fixed here: it needs the owner's
  decision (see A-1).
- **A malformed .xlsx froze the builder tab permanently** (SheetJS 0.18.5). **Fixed:** Excel is now read in a worker
  that is stopped after 15 s.
- **No secrets were found** in the repository, any branch, any commit, or the local folder.
- **The Apps Script web app accepts writes from anyone who has its URL** (the URL is not public). A shared-secret check
  is now implemented but becomes effective only when the owner sets it (manual step).
- AdeyIQ has **no accounts and no shared database on the website**, so there is no path for one website user to read
  another user's cargo.

This audit lowers risk; it does not prove the absence of vulnerabilities.

## Scope and limitations

| In scope | How |
|---|---|
| All code in the repository, all branches and history | Source review, regex secret scan over `git log --all -p` |
| Browser behaviour | Local production build (`next start`) + headless Chrome with CDP network capture, mock sheet |
| API routes | Unit tests and local HTTP tests |
| Apps Script | Source in `scripts/access-requests.gs` (the deployed copy could not be inspected) |
| Live site | Read-only header and page fetches only; no active tests against production |

**Not verified (no access):** the deployed Apps Script version and its "Who has access" setting; Google Sheet sharing
settings; Vercel project settings (environment-variable scopes, deployment protection, team members, log retention);
GitHub repository settings (branch protection, collaborators, secret scanning); who the claude.ai artifacts are
shared with; Vercel Web Analytics payload contents on production; Safari/Firefox behaviour.

## Architecture and trust boundaries

```
 USER'S BROWSER (trusted by the user; cargo lives here)                     |  AdeyIQ / third parties (untrusted for cargo)
 -------------------------------------------------------------------------  |  ---------------------------------------------
 build.html  ── cargo in memory + localStorage "adeyiq-ships" ──► stays      |
    │  CSV parse (main thread) · Excel parse (xlsx-worker.js, 15 s limit)     |
    │  3D packing, load plan, print window, HTML export (blob)  ──► stays     |
    │                                                                         |
 track.js ── usage event {event, page, visitor id, aircraft type, short ─────┼─► /api/track (Vercel) ─► Apps Script ─► Google Sheet "Usage"
            status, screen width, referrer origin}  NO cargo                  |
 home.html form ── name, email, company, phone, modules, message ────────────┼─► /api/request (Vercel) ─► Apps Script ─► "Access requests" + email
 ★ Rate ── answers + role + comment (≤150 chars, user-typed) ────────────────┼─► /api/track ─► "Usage" (event feedback)
 page loads ── fonts, SheetJS script (no data, IP + origin visible) ─────────┼─► fonts.googleapis.com, fonts.gstatic.com, cdnjs.cloudflare.com
 page loads ── page view (path) ─────────────────────────────────────────────┼─► /_vercel/insights (Vercel Web Analytics, same origin)
 --------------------------------------------------------------------------------------------------------------------------------------------
 claude.ai ARTIFACT copies (separate product surface, NOT the website):
 adeyiq-builder.html ── full shipment rows (AWB, dims, kg, goods, SHC, DG, UN) ──► Google Sheets connector ─► "Shipments", "ULD builds", "Load plans"
                     ── shipments ──► artifact shared database (all viewers)
 adeyiq-modules.html ── access requests (name, email, phone) ──► artifact shared database
```

## Confirmed findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| A-1 | **High** | claude.ai artifact builder sends full shipment data to the Google Sheet and a viewer-shared database | **Open** (owner decision) |
| A-2 | Medium | Usage analytics carried cargo-derived totals (kg, t, DG flag, ULD ids/positions, ULD panel text) | **Fixed + verified** |
| A-3 | Medium | Malformed .xlsx froze the builder tab permanently (SheetJS 0.18.5 hang on main thread) | **Fixed + verified** |
| A-4 | Medium | No upload limits: absurd piece counts, huge files and row counts; damaged files failed silently | **Fixed + verified** |
| A-5 | Medium | Apps Script accepts unauthenticated writes from anyone holding the `/exec` URL | **Fixed in revision 2** (signed, fail-closed); needs owner configuration and deployment |
| A-6 | Medium | Spreadsheet ID hard-coded in the public `build.html` | **Fixed + verified** (still in local artifact copy) |
| A-7 | Medium | SheetJS 0.18.5 has public advisories (CVE-2023-30533 prototype pollution, CVE-2024-22363 ReDoS) | **Fixed in revision 2**: self-hosted 0.20.3, verified |
| A-8 | Low | Apps Script replied with internal error text; formula guard missed leading TAB/CR | **Fixed in revision 2** (unit-tested with the real script); needs deployment |
| A-16 | High | First-pass fix left `scripts/access-requests.gs` syntactically invalid, uncovered by any test | **Fixed in revision 2**; syntax check added to CI |
| A-9 | Low | Full referring URL sent with usage events | **Fixed + verified** (origin only) |
| A-10 | Low | CSP allowed an unused script host (`cdn.jsdelivr.net`) | **Fixed + verified** |
| A-11 | Low | `esc()` did not escape single quotes (no exploitable sink found) | **Fixed** (defence in depth) |
| A-12 | Low | Rate limits are per serverless instance; `Origin` can be forged by non-browser clients, so analytics can be polluted | **Open** (documented) |
| A-13 | Low | Cargo persists in `localStorage` indefinitely (shared-device risk) | **Mitigated** (Clear button verified; privacy page advises using it) |
| A-14 | Low | CDN scripts without Subresource Integrity; GitHub Actions pinned to tags, not commit SHAs | **Open** (recommendations) |
| A-15 | Info | `Access-Control-Allow-Origin: *` on static responses (Vercel default) | Accepted: pages are public |

### A-1 · High · Artifact copies send cargo off the device
- **Evidence:** `adeyiq-builder.html` (local, untracked): `report('Shipments!A1', …shipRow(s))` where `shipRow` returns
  AWB, pieces, L, W, H, weight, goods, SHC, DG, UN, ULD id and position; `report("'ULD builds'!A1")`,
  `report("'Load plans'!A1")`; `db.collection('shipments')` / `db.doc('shipments/'+id)` (artifact database that viewers
  share). `adeyiq-modules.html`: `db.doc('requests/'+uid)` stores name, email, company and phone.
- **Exploitability:** anyone the artifact is shared with can open it and, through the shared database, see shipments
  entered by other viewers; shipment rows are also written into the owner's Google Sheet.
- **Remediation (needs approval):** stop sharing the artifact builder, or republish it without `db`/`mcp`
  persistence (use the website's localStorage model); delete the Shipments / ULD builds / Load plans tabs or rows if
  they contain other people's cargo; treat adeyiq.vercel.app as the only public surface.

### A-2 · Medium · Cargo-derived analytics (fixed)
- **Evidence (before):** `public/adeyiq/track.js` `built()` = `txt("st1s") + txt("sum")` → "9 ULDs · 10,700 kg built";
  `loaded()` added `hchips` → "10.7 t DG · NOTOC"; `bT` → "BUILD-UP · PMC001 → 11P"; print → first 60 chars of the ULD
  panel. These reached the Usage tab.
- **Fix:** status only ("9 ULDs built", "Balanced ✓ · 2 offloaded"); no weights, DG flags or ULD ids.
- **Verification:** e2e "usage events carry no weights, DG details or ULD ids" (pass).

### A-3 · Medium · Malformed Excel froze the page (fixed)
- **Repro:** upload a file named `broken.xlsx` containing a ZIP header followed by filler bytes
  (`PK\x03\x04\x14\x00\x00\x00\x08\x00` + 300 × `A`). Before the fix the tab hung indefinitely (e2e timed out after
  8 minutes at this step).
- **Fix:** `public/adeyiq/xlsx-worker.js` parses Excel off the main thread; `readXlsx()` in `build.html` stops it after
  15 s and shows a message. Same-origin worker: the existing CSP allows it.
- **Verification:** e2e "a damaged .xlsx … no longer freezes the page" (pass; page answers immediately).

### A-4 · Medium · Upload limits (fixed)
- **Before:** no file-size, row, shipment or value caps; a line with 999,999,999 pieces would make the builder create
  ULDs for minutes; `XLSX.read` errors were uncaught.
- **Fix:** `LIM={fileMB:10,rows:5000,ships:5000,pcs:10000,kg:250000,cm:2000}`, extension check, binary-CSV check, field
  caps in `mk()` (AWB 40, goods 200, UN 12, 12 SHC codes × 8 chars), SheetJS options `cellFormula:false,
  cellHTML:false, cellStyles:false, bookVBA:false, sheetRows`.
- **Verification:** e2e hostile-manifest checks (all pass; absurd values skipped in 355 ms).

### A-5 · Medium · Unauthenticated writes to the Apps Script
- **Evidence:** `scripts/access-requests.gs` `doPost` had no caller check; the deployment is "Execute as: Me / Who has
  access: Anyone". Anyone holding the `/exec` URL can append rows (spam, fake analytics, email flooding via access
  requests). The URL is held only in Vercel (`ADEYIQ_SHEET_URL`); it is not in the repo, its history, or browser code.
  There is no `doGet`, so the URL does not allow reading the sheet.
- **Fix:** optional shared secret: the script refuses writes without `key` once the Script property `ADEYIQ_KEY` is set;
  `lib/sheet.ts` sends `ADEYIQ_SHEET_KEY`. **Inactive until the owner sets both values** (checklist).

### A-6 · Medium · Spreadsheet ID in public code (fixed on the website)
- **Evidence:** `public/adeyiq/build.html` `const GS={…id:'1-jMb…'}` (dead code on the website). An ID alone grants no
  access, but it becomes a data leak if the sheet's sharing is ever "Anyone with the link".
- **Fix:** removed from the website copy; e2e checks the public page. **Still present** in the local artifact copy.

### A-7 · Medium · SheetJS 0.18.5 advisories
- CVE-2023-30533 (prototype pollution when reading crafted files, fixed in 0.19.3) and CVE-2024-22363 (ReDoS, fixed in
  0.20.2). 0.18.5 is the last version on npm/cdnjs; newer builds are published on cdn.sheetjs.com.
- **Mitigation now:** parsing runs in an isolated worker (pollution cannot reach the page's objects; hangs are cut at
  15 s), with size and row limits.
- **Remediation (needs approval):** self-host SheetJS 0.20.3+ from the official source under `public/vendor/` with a
  pinned hash, and drop cdnjs.

### A-12 · Low · Analytics integrity
- `sameOrigin()` blocks other websites in browsers, but a script can send any `Origin` header. Limits (60 events/min,
  5 requests/h per IP) are per serverless instance. Someone can still add fake usage rows slowly or from many IPs.
  Vercel documents that it overwrites `x-forwarded-for`, so the IP key cannot be spoofed by the client.
- **Recommendation:** treat the Usage tab as indicative; add the Apps Script secret (A-5); add Vercel Firewall rate
  rules if abuse appears.

### Checked and not vulnerable
- **Stored/DOM XSS:** all shipment fields reach the DOM through `esc()` or `textContent`. Hostile CSV values
  (`<img onerror>`, `<script>`, `<svg onload>`, RTL override, zero-width characters) render as text in the builder and
  in exports (e2e pass).
- **Prototype pollution via CSV headers:** `rowsToShips` only maps known header names, and `mk()` builds fixed-key
  objects (e2e pass).
- **Formula execution:** neither the CSV reader nor SheetJS evaluates formulas; `=HYPERLINK`/`=WEBSERVICE` stay text and
  trigger no requests (e2e pass). Values written to the sheet are prefixed `'` when they start with `= + - @` (TAB and CR
  added in the fix).
- **eval and dynamic code:** none. `document.write` is used only to fill the print window with escaped HTML.
- **Service workers, IndexedDB, sessionStorage, cookies, Cache Storage:** none used by the website.
- **SSRF:** no user-controlled URL is fetched server-side. **HTTP methods:** non-allowed methods return 405 (e2e).
  **Error replies:** `{ok:false}` without internals (e2e).
- **Secrets:** none found (patterns: Apps Script URLs/IDs, Google API keys, GitHub/Slack/Vercel/OpenAI tokens, private
  keys, service-account JSON, password literals) in any commit of any branch or in the local folder.
- **Source maps:** the build emits no browser source maps; none are published.
- **Headers (live):** HSTS with preload, CSP, `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
  `frame-ancestors 'self'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
- **Dependencies:** `npm audit --omit=dev` = 0 vulnerabilities; 10 moderate ones in development tools only.
