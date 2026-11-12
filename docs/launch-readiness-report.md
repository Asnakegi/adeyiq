# AdeyIQ launch-readiness report

**Date:** 12 November 2026
**Branch:** `launch-readiness` (from `main` at `bf2a85f`), 8 commits including this report, **not pushed or deployed**
**Scope:** the public site at adeyiq.vercel.app: home page, Cargo Builder, hold view, aircraft data, API routes, and the demo dashboard pages.

## Verdict: READY WITH CONDITIONS

The product pages and API are fit for a public, free, early-access launch to the target audience (cargo teams, GSAs, forwarders, ground handlers), once the conditions below are met. All fixes are on the branch and every automated check passes locally. Nothing has been verified on a Vercel deployment yet.

This is a judgement for an anonymous, no-login early-access tool whose cargo data never leaves the user's browser. It is **not** an assessment of enterprise readiness. There are no accounts, no SLA, no audit trail, no server-side data store beyond a Google Sheet, and no formal security or legal review.

### Conditions before launch

1. **Deploy a preview first and check it.** Open the branch's Vercel preview deployment. Then:
   - Confirm `/api/health` shows `sheetConfigured: true`.
   - Open `/` and `/build` from a normal browser and confirm new Usage rows appear in the sheet.

   The new same-origin check compares the browser's `Origin` with the request host. It passes locally, but it has not run behind Vercel's proxy. If it fails there, usage events are refused with 403 and silently lost. Use `?owner=1` on your device so these test rows are filtered out.
2. **The owner merges and deploys.** I have not pushed or deployed anything (authorization required).
3. **Set up an uptime monitor** on `/api/health` (see `docs/operations.md`).
4. **Owner decisions on the privacy page:**
   - Set a retention period. The page currently says none is set yet.
   - Confirm the deletion-request route (via the access form).
   - Decide whether a legal review is needed for the countries you market to (for example, GDPR if you target EU forwarders).

   The page is factual about what the code sends, but it is not legal advice.
5. **Delete test rows from the sheet** (I do not have permission to delete your content). See "Test data" below.

## What was fixed

| # | Priority | Fix | Files | Commit |
|---|---|---|---|---|
| 1 | Critical | Next.js 16.2.6 → 16.4.6 (critical and high advisories: middleware bypass, DoS, SSRF, cache confusion). `npm audit fix`. Production audit: 29 → **0** vulnerabilities | `package.json`, `package-lock.json` | `981c200` |
| 2 | High | Removed unused packages that had their own advisories (`axios`, `xlsx`, `three`, `recharts`, `@types/three`); `shadcn` moved to dev dependencies | `package.json` | `981c200` |
| 3 | High | API abuse protection:<br>• same-origin check<br>• body-size limits (4 KB usage, 8 KB requests)<br>• per-client rate limits (60 usage events/min, 5 access requests/hour)<br>• strict JSON-object parsing<br>• event allow-list | `lib/api.ts`, `app/api/track/route.ts`, `app/api/request/route.ts` | `981c200` |
| 4 | High | Silent failures removed:<br>• failed sheet writes and a missing `ADEYIQ_SHEET_URL` are logged (no personal data in logs)<br>• the access form gets 503/502 and shows its copy-and-send fallback<br>• new `/api/health` reports config presence, never values<br>• sheet calls time out after 8 s | `lib/sheet.ts`, `app/api/health/route.ts` | `981c200` |
| 5 | Medium | Security headers on every response: CSP (`frame-ancestors 'self'`, `object-src 'none'`, `connect-src 'self'`, script and style sources limited to self + named CDNs), `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` | `next.config.ts` | `981c200` |
| 6 | Medium | Demo dashboard (invented flights, alerts, DG data) is labelled as sample data on every page and set to `noindex` | `app/layout.tsx` | `981c200` |
| 7 | Medium | Lint: 17 errors → 0 (typed the 3D view, escaped entities, Node scripts in `test/` allowed `require`) | `app/3dview/page.tsx`, `app/page.tsx`, `app/reports/page.tsx`, `eslint.config.mjs` | `7e8dd90` |
| 8 | Medium | Privacy page at `/privacy`, linked from all four product pages | `public/adeyiq/privacy.html`, `home.html`, `build.html`, `hold-view.html`, `aircraft-data.html` | `bdbbf12`, `d79d7ae` |
| 9 | Medium | Builder said "✓ Saved", which implies an account. It now says "Saved on this device", with a note that cargo is not sent to AdeyIQ | `public/adeyiq/build.html` | `bdbbf12` |
| 10 | Medium | **Accessibility bug found by E2E:** the four savings sliders on the home page had no accessible name. Their `<label>` attached to the `<output>` inside it instead of the slider. Fixed with `for=` | `public/adeyiq/home.html` (also in your local `adeyiq-modules.html`) | `79506a3` |
| 11 | Medium | Tests added: 14 API unit tests, 12 packing-engine regression tests (read from the shipped `build.html`), 56 end-to-end checks; `npm test`, `npm run test:e2e`, `npm run typecheck` | `test/api.test.ts`, `test/engine.test.mjs`, `test/e2e.mjs`, `package.json`, `tsconfig.json` | `0b883f0`, `79506a3` |
| 12 | Low | CI on every pull request: lint, type check, tests, build, E2E, production audit | `.github/workflows/ci.yml` | `4f07cc8` |
| 13 | Low | Operations guide (deploy, rollback, env vars, Apps Script redeploy, backups, monitoring, incidents) and a real README | `docs/operations.md`, `README.md` | `4f07cc8` |

## Checks run (final state, local)

| Check | Result |
|---|---|
| `npm ci` (clean install from lockfile) | Pass |
| `npm run lint` | 0 errors, 5 warnings (unused variables in demo pages and `track.js`) |
| `npm run typecheck` | Pass |
| `npm test` | 26/26 pass, plus all oversize checks |
| `npm run build` | Pass (Next.js 16.4.6) |
| `npm run test:e2e` | **56/56 pass** |
| `npm audit --omit=dev` | 0 vulnerabilities |
| `npm audit` (including dev tools) | 12 (2 low, 10 moderate), all in lint/CLI tooling (`minimatch`, `deepmerge`), not shipped |

The CI workflow has not run on GitHub yet, because the branch has not been pushed.

## Journeys verified end to end

These ran against the local production build (`next start`) and headless Chrome. A mock sheet server stood in for Google Apps Script, so no production data was touched.

- **Home:**
  - Empty access form shows field errors and sends nothing.
  - Valid request shows "Request sent." and the row reaches the sheet with fields intact.
  - HTML typed into a field is displayed as text.
- **Home with the sheet down:** the form shows the copy-and-send fallback and the server logs the failure. The request is not lost silently.
- **Builder:**
  - Sample cargo builds ULDs and the 3D view draws.
  - Add, edit and delete a shipment all work and are saved in local storage.
  - Load to aircraft opens the hold view.
  - Feedback reaches the sheet in the Feedback-tab format, with pipes in comments neutralised.
- **Hostile CSV upload:** values such as `<img onerror>`, `<script>` and `<svg onload>` are stored and shown as visible text and never run.
- **Usage tracking:**
  - `sendBeacon` events pass the origin check and reach the sheet.
  - Headless and bot user agents are dropped.
- **API from outside the browser:**
  - cross-site POST → 403
  - missing Origin → 403
  - unknown event → 400
  - oversized body → 413
  - sixth access request within the hour → 429
- **Mobile, 375 px:** no horizontal scroll on `/`, `/build`, `/hold-view`, `/aircraft-data` or `/privacy`.
- **Basic accessibility on those pages:**
  - `lang` is set.
  - Each page has a main heading.
  - Every form field is labelled, every image has alt text and every button has a name.
- **No CSP violations or uncaught page errors.**
- **Local performance:** `/` loads in about 70 ms and `/build` in about 120 ms (local, not network-realistic). A 100-shipment upload builds in about 2.2 s.

### Earlier tests against production

Before this audit, and with your agreement, light tests ran against the live site:

- **30 simultaneous usage writes:** 18 were lost before retries were added; 30/30 were saved after.
- **100 shipments:** took 16 s and froze the page; now about 2.6 s.
- **Several open tabs:** they overwrote each other's cargo; fixed with merge-on-save.

No destructive or load tests were pointed at production during this audit.

## Remaining issues (ranked)

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| 1 | High (until verified) | Origin check untested behind Vercel's proxy (condition 1) | Verify on the preview deployment before promoting |
| 2 | Medium | The Apps Script web app accepts writes from **anyone who has its `/exec` URL**, bypassing the API's limits. The URL is kept out of the repo, but it is a bearer secret | Add a shared secret: the route sends a key from a new env var, and the script rejects requests without it. Needs an Apps Script redeploy by the owner |
| 3 | Medium | Rate limits are per serverless instance (in memory), so they are best effort against a determined attacker | Acceptable for launch. If abuse appears, move to a shared store (for example Vercel KV or Upstash), which would be a new paid or free-tier service and needs your approval |
| 4 | Medium | The builder loads SheetJS `xlsx` **0.18.5** from cdnjs for Excel uploads. That version has published advisories (prototype pollution, ReDoS) when parsing crafted files. It runs only in the user's own browser on files they choose | Move to SheetJS 0.20.x, which is published on cdn.sheetjs.com and not on npm or cdnjs. That needs a CSP update and a re-test of uploads |
| 5 | Medium | CSP has to allow `'unsafe-inline'` scripts because the product pages are single-file HTML with inline code | It still blocks third-party script hosts, framing and plugins. Moving the inline scripts into files (or nonces) would allow a strict CSP |
| 6 | Low | Privacy page owner decisions (retention, legal review) | Condition 4 |
| 7 | Low | Sheet backup and restore not rehearsed | Do one test restore from version history on a copy (`docs/operations.md`) |
| 8 | Low | Packing density: in a full AKE of 50×40×40 cm boxes the engine places 36, against roughly 45 by hand, because the slanted lower floor is used conservatively. Builds are always valid (no overlaps, nothing floating, nothing outside the contour) | Product improvement. The new test locks 36 as a floor so it cannot get worse |
| 9 | Low | Demo dashboard pages are still public (labelled, noindex) | Remove them when no longer needed for demos |
| 10 | Low | Your local artifact copy of the builder (`adeyiq-builder.html`) does not have the "Saved on this device" text or the privacy link. The site copy does | Copy the changes across the next time you edit the artifact |
| 11 | Low | 5 lint warnings (unused variables) | Cosmetic |
| 12 | Info | If `ADEYIQ_SHEET_URL` is enabled for Preview deployments, preview visits write to the production sheet | Use `?owner=1` on previews, or a separate test sheet for Preview |

## Not tested, or mocked

- **Google Apps Script and the Sheet were mocked in E2E.** Real Apps Script behaviour (quotas, email sending, concurrency limits) was only exercised by the earlier production tests.
- **Vercel-specific behaviour:** the proxy and Origin/host headers, geo headers, Vercel Analytics, `after()` background work and function time limits. Geo headers are covered only by unit tests with fake values.
- **Browsers:** only Chrome (headless) was tested. Safari, Firefox and real iOS or Android devices were not.
- **Accessibility:** automated basics only. No screen-reader session, no full keyboard-only walkthrough and no colour-contrast audit.
- **Network performance:** real-network page speed (Core Web Vitals) and load beyond the earlier 30-concurrent test.
- **Not verified:** email notification for access requests; the Excel (`.xlsx`) upload path (only CSV was tested); the demo dashboard pages beyond a 200 response and the banner.
- **Backup restore:** not performed.

## Test data in your sheet to delete

You'll need to delete these from the raw **Usage** tab yourself. Clean usage already filters them out.

- visitor `setup-test`
- visitor `owner-loadtest` (about 52 rows from the load test)
- any rows I added while testing the feedback and usage flow earlier (visitor ids beginning `claude` or `test`)

The E2E run in this audit wrote only to the local mock.

## Deploy and monitoring checklist

- [ ] Review the 8 commits on `launch-readiness` and push the branch
- [ ] Wait for the GitHub Actions CI run to pass
- [ ] Open the Vercel preview with `?owner=1`. Check `/api/health`, that a Usage row arrives, that the access form shows "Request sent." (one test request, then delete it) and that `/privacy` loads
- [ ] Check the response headers on the preview (CSP present, no console CSP errors on `/` and `/build`)
- [ ] Merge to `main`. Vercel deploys production
- [ ] Repeat the health and Usage-row checks on production
- [ ] Add an uptime monitor on `/api/health`, every 5 minutes, alerting on non-200 or `sheetConfigured:false`
- [ ] Watch Vercel logs for `[track]` and `[request]` warnings for the first 48 hours
- [ ] Know the rollback: Vercel → Deployments → last good → Instant Rollback
- [ ] Make a copy of the Google Sheet before launch (File → Make a copy)
- [ ] Decide privacy retention and update `/privacy`
- [ ] Delete the test rows listed above
- [ ] Later: shared secret for the Apps Script (issue 2), SheetJS upgrade (issue 4)
