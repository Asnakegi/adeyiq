# Security test results

> **Revision 2 (19 Nov 2026):** the owner's review found that the first-pass Apps Script fix was syntactically
> invalid and that no test covered it. See `REMEDIATION_REPORT.md` for the corrected design, the tests that were
> missing, and the current status. Statuses below are updated; superseded statements are marked.

**Revision 2 totals (clean `npm ci`):** check:scripts 11/11 parse · unit 40/40 · e2e 100/100 · lint 0 errors · typecheck · build · audit 0.
First-pass rows that relied on the permissive mock sheet are marked below.

**Revision 3 totals (release review, `5099c74`):** check:scripts 11/11 · unit 42/42 (2 new: daily email budget survives cache eviction; error logs hold no user data) · e2e 105/105 (5 new: product pages allow inline scripts by hash, not `unsafe-inline`) · lint 0 errors · typecheck · build · audit 0. `scripts/verify-sheet-endpoint.mjs` passed 5/5 against a local stand-in running the real `.gs`. **It has not yet been run against a deployed Google endpoint** (owner step, `RELEASE_READINESS.md` section 2). GitHub CI: PR 6 run 44508658305 passed every step (Ubuntu, Node 24). Since revision 2 the product pages no longer contact cdnjs (SheetJS is self-hosted).


**Environment:** local production build (`next start`, port 5300), mock Google Sheet (port 5301), headless Chrome
driven over the DevTools protocol, Windows 11, Node 26, 19 November 2026. No active tests against production; the
live site was only read (headers, page source).

**Reproduce:** check out `security-audit`, then run `npm ci && npm run build && npm test && npm run test:e2e`.
The e2e runner starts its own server and mock sheet, so it never contacts production.

## Tests executed

| Area | Test | Result | Evidence |
|---|---|---|---|
| Secrets | Regex scan of all commits on all branches (Apps Script URL/ID, Google API keys, GitHub/Slack/Vercel/OpenAI tokens, private keys, service-account JSON, password literals) | Pass: 0 hits | `git log --all -p` scan |
| Secrets | Scan of the local working folder, including untracked files | Pass: only the spreadsheet ID, in the artifact copy | grep |
| Secrets | `.env`, credential or key files ever committed | Pass: none | `git log --all --name-only` |
| Build | Browser source maps emitted | Pass: 0 `.map` files in `.next/static` | build output |
| Headers | Live response headers | Pass: HSTS, CSP, nosniff, XFO, Referrer, Permissions | `curl -I` |
| Privacy | Synthetic cargo in CSV, Excel and the form, used across 15 flows; every request and forwarded row searched for markers | **Pass:** 0 of 39 requests, 0 of 13 rows | e2e "Privacy" |
| Privacy | Hosts contacted | Pass: localhost, fonts.googleapis.com, fonts.gstatic.com, cdnjs.cloudflare.com | e2e |
| Privacy | Third-party requests carry no data | Pass: 18 GETs, no body or data query | e2e |
| Privacy | Usage details free of weights, DG flags, ULD ids | Pass (after fix A-2) | e2e |
| Privacy | Referrer reduced to origin | Pass (after fix A-9) | e2e |
| Privacy | No sheet ID or Apps Script URL in the public page | Pass (after fix A-6) | e2e |
| Privacy | Refresh keeps cargo locally; Clear removes it | Pass | e2e |
| Uploads | CSV formulas (`=HYPERLINK`, `=WEBSERVICE`, DDE-style `@SUM…cmd`) | Pass: text, no request | e2e |
| Uploads | Excel formula cell | Pass: stored value only, no request | e2e |
| Uploads | Damaged .xlsx (ZIP header + filler) | **Failed before fix** (tab froze; e2e timed out after 8 min). **Pass after fix A-3** | e2e runs 3 and 4 |
| Uploads | `.exe` extension; binary file renamed `.csv` | Pass (after fix A-4) | e2e |
| Uploads | 5,002-line CSV | Pass: refused (after fix A-4) | e2e |
| Uploads | 999,999,999 pieces / kg; 99,999 cm | Pass: skipped in 355 ms (after fix A-4) | e2e |
| Uploads | `__proto__`, `constructor`, `prototype` headers | Pass: no pollution | e2e |
| Uploads | RTL override, zero-width, emoji, CJK, Arabic, HTML in text | Pass: shown as text | e2e |
| XSS | Hostile names in builder, HTML export and print | Pass | e2e (existing and new) |
| API | Cross-site POST, missing Origin, unknown event, oversize, rate limits, honeypot, bot UA | Pass | `test/api.test.ts`, e2e |
| API | PUT/DELETE `/api/track`, GET `/api/request`, POST `/api/health` | Pass: 405 | e2e |
| API | Malformed JSON reply has no internals | Pass: `{"ok":false}` | e2e |
| Sheet writer | ~~Shared secret added when configured~~ (first pass: Next side only, **did not cover the script**) → revision 2: signed writes accepted by the real script; wrong, missing and short keys refused; key never in URL or body | Pass | `test/sheet.test.ts`, `test/gs.test.mjs` |
| Apps Script | Syntax of `scripts/*.gs` and all browser scripts | Pass (fails on the first-pass commit) | `npm run check:scripts` |
| Apps Script | Direct calls bypassing the website: unsigned, wrongly signed, replayed | Pass | e2e |
| SheetJS | Self-hosted 0.20.3 served unchanged (SHA-256) | Pass | e2e |
| Regression | Packing-engine invariants, oversize checks, 777F 300-piece charter (37/37, Balanced ✓ · 2 offloaded), prints and exports | Pass | `npm test`, e2e |
| Dependencies | `npm audit --omit=dev` | Pass: 0 | npm |

**Totals:** unit 29/29, e2e 93/93, lint 0 errors, typecheck pass, build pass.

## Untested areas and reasons

| Area | Reason |
|---|---|
| Deployed Apps Script and its access settings | No access to the Google account; verify with the checklist |
| Google Sheet sharing settings | No access; verify with the checklist |
| Vercel project settings, logs, Preview protection | No access to the Vercel dashboard |
| GitHub settings (branch protection, secret scanning) | No admin access |
| Who the claude.ai artifacts are shared with | Not visible to the audit |
| Vercel Web Analytics payloads | The script exists only on Vercel; not tested against production |
| Safari, Firefox, mobile browsers | Only headless Chrome available |
| Load or volume testing against production | Out of scope by instruction |
| ~~SheetJS 0.20.x upgrade~~ | Done in revision 2 (owner requested it) |
| Apps Script in Google's runtime | Tested in Node with stand-in services; the real deployment must be checked after the owner deploys it |
