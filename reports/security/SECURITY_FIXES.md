# Security fixes

Branch `security-audit`, commit `35674ba` (plus the reports). **Not merged and not deployed.** The Apps Script change
also needs to be pasted into the script editor and deployed by the owner.

## Fixes implemented

| Finding | Fix | Files |
|---|---|---|
| A-2 analytics carried cargo totals | Usage status only: "N ULDs built", "Balanced ✓ · N offloaded"; nothing from ULD panels or the build-up bench | `public/adeyiq/track.js` |
| A-9 full referrer | Referrer sent as scheme + host only | `public/adeyiq/track.js` |
| A-3 malformed .xlsx froze the page | Excel parsed in a same-origin worker; `readXlsx()` stops it after 15 s and shows a message | `public/adeyiq/xlsx-worker.js` (new), `public/adeyiq/build.html` |
| A-4 no upload limits | 10 MB, 5,000 lines, 5,000 shipments; per line ≤10,000 pcs, ≤250,000 kg, ≤2,000 cm; extension and binary-CSV checks; capped field lengths; SheetJS without formulas, HTML, styles, macros | `public/adeyiq/build.html` |
| A-6 spreadsheet ID in public code | ID removed from the website copy; `report()` is a no-op without it | `public/adeyiq/build.html` |
| A-11 `esc()` | Also escapes `'` | `public/adeyiq/build.html` |
| A-10 CSP | Unused `https://cdn.jsdelivr.net` removed from `script-src` | `next.config.ts` |
| A-5 unauthenticated writes | Optional shared secret: `ADEYIQ_SHEET_KEY` (Vercel) sent as `key`; script refuses writes without it once `ADEYIQ_KEY` is set | `lib/sheet.ts`, `scripts/access-requests.gs` |
| A-8 error disclosure, formula guard | Replies `{ok:false}` only, error logged for the owner; leading TAB/CR also neutralised | `scripts/access-requests.gs` |
| Privacy text | Status-only events, referrer origin, Clear advice, local printing, Vercel Web Analytics | `public/adeyiq/privacy.html` |

Cargo-building and load-planning code was **not changed**.

## Tests added

| Test | What it proves |
|---|---|
| `test/sheet.test.ts` (2 tests) | The secret is added when configured and absent otherwise; failures return `false` |
| e2e "Privacy" (9 checks) | Synthetic cargo via CSV, Excel and the form never appears in any browser request or forwarded row, across build, load, print, export, aircraft switch, refresh and clear; only AdeyIQ, Google Fonts and cdnjs are contacted; third-party requests carry no data; usage details have no weights, DG or ULD ids; referrer is an origin; no spreadsheet ID or Apps Script URL in the page; Clear empties storage |
| e2e "Hostile manifests" (10 checks) | CSV and Excel formulas stay text and fetch nothing; a damaged .xlsx no longer freezes the page; wrong file types and binary CSVs are refused; >5,000 lines refused; absurd values skipped quickly; `__proto__`/`constructor` headers don't pollute; Unicode and HTML shown as text; HTML export has no script, handlers or `javascript:` |
| e2e "API" (5 checks) | Non-allowed methods get 405; malformed requests get a short error without internals |

## Test results (local, 19 November 2026)

| Check | Result |
|---|---|
| `npm run lint` | 0 errors (4 old warnings in demo pages and `track.js`) |
| `npm run typecheck` | Pass |
| `npm test` (API + sheet unit tests, packing-engine tests, oversize checks) | 29/29 pass; oversize all pass |
| `npm run build` | Pass |
| `npm run test:e2e` | **93/93 pass** (includes the unchanged 777F 300-piece charter: 37/37 positions, Balanced ✓ · 2 offloaded) |
| `npm audit --omit=dev` | 0 vulnerabilities |

## Re-test of confirmed findings

| Finding | Before | After |
|---|---|---|
| A-2 | Usage detail "9 ULDs · 10,700 kg built", "10.7 t DG · NOTOC" | "9 ULDs built", "Balanced ✓" (e2e pass) |
| A-3 | Tab frozen, e2e timed out after 8 min | Message after ≤15 s, page responsive (e2e pass) |
| A-4 | 999,999,999 pieces accepted | Line skipped with reason in 355 ms (e2e pass) |
| A-6 | Sheet ID in `/build` source | Not present (e2e pass) |
| A-5, A-8 | – | Unit-tested on the Next side; **Apps Script side not verifiable until deployed** |

## Remaining risks

- **A-1** claude.ai artifact copies (High): needs the owner's decision.
- **A-5** becomes effective only after the owner sets the secret in both places.
- **A-7** SheetJS 0.18.5 is still the parser (now isolated and time-limited); upgrading needs approval.
- **A-12** analytics can still be polluted slowly; **A-14** no SRI or SHA-pinned actions.
