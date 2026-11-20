# Security remediation: before and after (revision 2)

**Date:** 19 November 2026 · branch `security-audit` · not merged, not deployed, no credentials or production data changed.
This revision follows the owner's independent review, which found a defect the first audit pass introduced and missed.

## 1. The defect the review found

| | |
|---|---|
| **What** | `scripts/access-requests.gs` line 23 was invalid JavaScript: the new `clip()` statement had the original two statements spliced into its middle. Pasted into Apps Script, the web app would not have saved or deployed. |
| **Root cause** | The patch tool used `String.prototype.replace(search, replacementString)`. The replacement text contained `"'$&"`, and in a replacement string `$&` means "insert the matched text", so the old lines were inserted. |
| **Blast radius check** | Every patch script used in this project was scanned for `$&`, `` $` ``, `$'` and `$$` in replacement strings: this was the only one. The builder pages were also exercised end to end. |
| **Prevention** | `scripts/check-syntax.mjs` parses every `scripts/*.gs` file and every browser script of the product pages; it runs in `npm test` and as its own CI step (`npm run check:scripts`). Run against the broken commit, it fails with `Invalid or unexpected token`. Later patches use `split/join` with an exact-one-match check, never `replace()` with a string. |

## 2. Tests previously reported as passing that did not cover the affected code

| Earlier claim | Why it was not real coverage |
|---|---|
| "A-5 and A-8 fix implemented" (shared secret, generic errors, formula guard) | No test ever parsed or ran the `.gs` file. The fix was syntactically broken. |
| `test/sheet.test.ts`: "secret sent when configured" | Tested only the Next.js side of the exchange, never the Apps Script receiving it. |
| e2e "accepted event reaches the sheet", "request row reaches the sheet", "Privacy … forwarded rows" | The e2e mock sheet answered `{"ok":true}` to **any** body, so authentication, formula handling and validation in the script were never exercised. The privacy assertions themselves (no cargo in requests) remain valid. |
| CI "lint, typecheck, test, build, e2e" | `.gs` files are not TypeScript and are not linted, and nothing parsed them, so CI could not catch the defect. |
| "A-7 SheetJS mitigated" | Tests ran against SheetJS 0.18.5 from cdnjs. The library has now been replaced and the tests re-run against the self-hosted 0.20.3. |
| "A damaged .xlsx no longer freezes the page" | Still true, but it passes through the worker's 15 s time limit: **SheetJS 0.20.3 also hangs on that file.** The protection is the worker, not the newer parser. |

## 3. Changes in this revision

| Area | Before | After |
|---|---|---|
| Apps Script syntax | Invalid (line 23) | Rewritten and parsed in CI; behaviour unit-tested with the real file |
| Apps Script authentication | Optional plain secret in the JSON body; **open if `ADEYIQ_KEY` was not set** | **Fails closed:** no `ADEYIQ_KEY` (or shorter than 32 characters) means every write is refused. Each write is an HMAC-SHA256 signed envelope `{v, ts, nonce, payload, sig}`; the key itself is never transmitted |
| Replay | Not prevented | Timestamp must be within ±5 minutes; each nonce is accepted once (10-minute cache) |
| Flooding the sheet and email quota | Only the per-instance Vercel limits | Plus a global cap of 120 writes a minute and 50 emails a day in the script |
| Website side | Sent writes even without a key | `sheetReady()` requires both `ADEYIQ_SHEET_URL` and a key of ≥32 characters; otherwise nothing is sent. Access requests answer 503 (users get the copy-and-send fallback); usage events are dropped with one log line naming the missing setting (never its value); `/api/health` shows `sheetConfigured: false` |
| Secret exposure | – | The key lives only in the Vercel environment and the Apps Script properties; never in browser code, URLs, logs or replies (unit-tested) |
| Error replies | Internal error text (in the broken version: none) | `{ok:false}` only; reasons logged for the owner without the key or row data |
| SheetJS | 0.18.5 from cdnjs (CVE-2023-30533, CVE-2024-22363) | **0.20.3** from the official cdn.sheetjs.com release, self-hosted in `public/vendor/sheetjs/0.20.3/` with its Apache-2.0 license, SHA-256 `cc015130…6f41` (package copy and direct download identical) and SRI value recorded; e2e checks the served file's hash |
| Third-party scripts on product pages | cdnjs allowed in CSP | No script CDN allowed (`script-src 'self' 'unsafe-inline'`, `worker-src 'self'`); only the legacy optimizer demo keeps cdnjs, on its own policy |
| Builder page weight | Loaded SheetJS on every visit | Loads it only inside the Excel worker, when someone uploads Excel |
| e2e mock sheet | Accepted anything | Runs the **real** `access-requests.gs` with stand-in Google services, so the website and the script are tested against each other |

## 4. Test evidence (local, clean `npm ci`)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 4 old warnings (demo pages, `track.js`) |
| `npm run typecheck` | Pass |
| `npm run check:scripts` | All 11 scripts parse (1 Apps Script file + 10 browser scripts) |
| `npm test` | **40/40**: API 14, sheet signing/agreement 5, Apps Script behaviour 8, packing engine 12, plus oversize checks |
| `npm run build` | Pass |
| `npm run test:e2e` | **100/100** |
| `npm audit --omit=dev` | 0 vulnerabilities |

Authentication cases tested against the real script:

| Case | Expected | Result |
|---|---|---|
| Correct key, fresh envelope | Accepted once | Pass (unit + e2e) |
| Website key differs from script key | Refused, nothing written | Pass |
| Key missing on the website / shorter than 32 | Nothing sent at all | Pass |
| Key missing or short in the script | Every write refused | Pass |
| Unsigned body (old format) / plain key in body (first-pass design) | Refused | Pass |
| Payload changed after signing | Refused | Pass |
| Same envelope twice | Second refused | Pass (unit + e2e) |
| Timestamp 6 min old or 6 min ahead | Refused | Pass |
| 130 writes in a minute | 120 accepted | Pass |
| Key or row data in replies or logs | Never | Pass |

## 5. Design assessment of the Apps Script endpoint

- **Why the body:** Apps Script web apps cannot read custom request headers, so credentials can only travel in the
  query string or the body. Query strings end up in logs and histories; the body does not. So the body was the right
  place, but a **static secret in the body** has two weaknesses: anyone who ever sees one request (a log, a proxy, a
  debugging session) has the secret forever, and it does nothing against replays.
- **What this revision does:** the secret never leaves Vercel. Each request carries an HMAC signature over a timestamp,
  a random nonce and the exact payload. A captured request cannot be altered, and it can't be reused after 5 minutes
  or more than once inside that window. Comparison is constant-time.
- **What a shared secret or signature cannot do:**
  - **No per-client rate limiting:** Apps Script only sees Vercel, not the visitor. Per-IP limits stay in the Next.js
    routes (best effort, per instance). The script adds only global caps.
  - **Not a defence if Vercel or its environment is compromised:** the key is there.
  - **The replay cache is best effort:** `CacheService` can evict entries early, which would reopen a replay window of
    at most 5 minutes for that nonce.
  - **The endpoint stays publicly callable:** "Who has access: Anyone" is required for Vercel to call it, so
    unauthenticated requests still cost a little quota before being refused.
- **Stronger long-term options (need the owner's approval):**
  1. **Recommended:** write to the sheet from Vercel with the Google Sheets API and a service account. The sheet is
     shared only with that account, so there is no public endpoint at all. A private key in a Vercel env var; no new paid
     service.
  2. Move analytics and access requests to a managed database with its own access control (likely a new service or
     cost).
  3. Keep this design, and add Vercel Firewall rate rules and alerting on Apps Script executions.

## 6. Deployment order (important: the new script fails closed)

> **Superseded:** `RELEASE_READINESS.md` replaces this procedure with a zero-gap rollout (test endpoint first, then a
> new production deployment, switched in the same Vercel deploy). The text below is kept for the record.

Merging before configuration would **stop usage recording and make the access form show its fallback** until both
values are set. This is not silent: health shows `sheetConfigured: false` and Vercel logs name the missing setting.

1. Generate one random key of 40+ characters (password manager). Don't paste it into chat, code or the sheet.
2. Apps Script → Project Settings → Script properties → `ADEYIQ_KEY` = key.
3. Vercel → Environment Variables → `ADEYIQ_SHEET_KEY` = same key (Production and Preview).
4. Merge the pull request (Vercel deploys).
5. Apps Script → replace the code with `scripts/access-requests.gs` from `main` → Deploy → Manage deployments → edit →
   New version → Deploy.
6. Check `/api/health` → `sheetConfigured: true`; open `/build?owner=1` and confirm a new Usage row; send one test access
   request and delete it afterwards.

The old deployed script does not understand signed envelopes, and the new script refuses the old unsigned format. So
between steps 4 and 5 writes fail. Do the two steps back to back: the gap is a few minutes, during which usage events
are lost and access requests fall back to copy-and-send.

## 7. Still open

- **claude.ai artifacts send and share shipment data (High).** See `ARTIFACT_REMEDIATION_PLAN.md`; nothing was changed
  or published.
- **Manual configuration** of the signing key in Apps Script and Vercel (section 6), and confirming the sheet's sharing
  is Restricted.
- **SheetJS hangs on some malformed ZIPs** even in 0.20.3: contained by the worker time limit. Consider reporting it
  upstream with the synthetic test file.
- Rate limiting per IP is best effort; analytics can still be polluted slowly by anyone (Low).
- This repository is public, so these reports are public too. They contain no secrets, URLs or sheet IDs, but they do
  describe weaknesses. Decide whether to keep them in the repo after the fixes are deployed.
