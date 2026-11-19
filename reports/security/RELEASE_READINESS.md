# Release readiness: `security-audit` → `main`

Date: 19 November 2026. Branch head: `5099c74`. Scope: the signed Apps Script integration, hash-based CSP, self-hosted
SheetJS in a worker, and the fixes listed in `REMEDIATION_REPORT.md`.

## Verdict

**Not production-ready yet.** The code and the automated tests are ready. The release stays blocked until three
things that only the owner can do are finished:

1. **A real signed write reaches a real Google Sheet.** Run `scripts/verify-sheet-endpoint.mjs` against a deployed
   test endpoint (section 2). Until then, the signed protocol has only been run against a local stand-in. That
   stand-in runs the real `.gs` file with simulated Google services. `sheetConfigured: true` proves nothing here: it
   only means the two environment variables are set.
2. ~~GitHub Actions passes on the pull request~~ **Done:** PR 6 CI passed (section 5). PR 6 was opened as a normal PR,
   not a draft. Convert it to draft, or simply do not merge it until Stage B.
3. **The High-risk claude.ai artifacts get a decision.** They are outside this release, but they are the largest
   remaining confidentiality risk (section 7).

Nothing was deployed. No credentials or production data were changed.

## 1. Why a separate endpoint

The new script refuses the old unsigned format, and the old script cannot read signed envelopes. If the code inside
the existing deployment is replaced, every write fails between that step and the Vercel deploy.

An Apps Script web app can have several deployments. Each one has its own `/exec` URL and its own pinned version of
the code. The plan therefore never edits the deployment production uses today:

- The new code goes into a **new deployment**, which gets a new URL.
- Vercel is switched to the new URL **in the same deploy** that ships the signing code. Vercel bakes environment
  variables into each deployment, so the old Vercel deployment keeps talking to the old Apps Script deployment.
- Rollback is Vercel Instant Rollback. The old URL is still live and unchanged.

The result is a switch with no gap in writes. You test first on a throw-away sheet, then on a second deployment of
the production sheet, before any visitor traffic moves.

## 2. Stage A: test endpoint (no production data involved)

Use a **new blank spreadsheet**, not a copy. A copy would duplicate the visitor and access-request data.

1. Google Drive → New → Google Sheets. Name it `AdeyIQ TEST`. Add two tabs named exactly `Usage` and
   `Access requests`. The script does not create them.
2. In that sheet: Extensions → Apps Script. Paste `scripts/access-requests.gs` from the `security-audit` branch
   (raw file). Save.
3. Generate a **test key** of 40+ random characters in your password manager. Use a different key from production.
4. Project Settings → Script properties → add `ADEYIQ_KEY` = the test key.
5. Deploy → New deployment → Web app. Execute as **Me**, Who has access **Anyone**. Authorise, then copy the `/exec`
   URL. Keep it out of chat, code and the repo.
6. On your PC, in the repo folder (PowerShell), run:
   ```
   $env:SHEET_URL="<test /exec URL>"; $env:SHEET_KEY="<test key>"; node scripts/verify-sheet-endpoint.mjs
   ```
   Expected: five lines that say PASS, then "All checks passed". The `Usage` tab of `AdeyIQ TEST` must contain
   **exactly one** new row with visitor `owner-verify`. Look at the sheet itself, because that row is the real proof.
   If the first check fails, check Apps Script → Executions. It logs a fixed reason such as `bad signature` or
   `ADEYIQ_KEY is missing`, and never the key or the data.
7. Close the PowerShell window afterwards, so the key does not stay in its environment.
8. Test through the site. In Vercel → Settings → Environment Variables, set **for Preview only**:
   `ADEYIQ_SHEET_URL` = the test URL and `ADEYIQ_SHEET_KEY` = the test key. Then redeploy the PR preview (Deployments
   → the preview → Redeploy), because environment changes apply only to new deployments.
9. On the preview URL, open `/build?owner=1`, add a sample, and build. Submit one access request on `/` with your own
   details. Expected: new rows in both `AdeyIQ TEST` tabs, and one email titled "AdeyIQ access request".
   `/api/health` on the preview shows `sheetConfigured: true`, but that is not the proof; the rows are.

Production is untouched by all of Stage A.

## 3. Stage B: production switch, in this exact order

Do this only after Stage A passes and CI is green.

1. Generate the **production key** (40+ random characters, password manager, never reused from the test).
2. Open the **production** sheet → Extensions → Apps Script.
   - First save a copy of the current code: File → Make a copy of the project, or copy the code into a local file.
   - Then paste the new `scripts/access-requests.gs` and Save.
   - Saving changes only the editor's head version. Existing deployments stay pinned to their old version, so
     production keeps working.
3. Project Settings → Script properties → add `ADEYIQ_KEY` = the production key. The old deployed code ignores this
   property.
4. Deploy → **New deployment** (not "Manage deployments → edit") → Web app, Execute as Me, access Anyone. Copy the new
   `/exec` URL. In Manage deployments you now see two active deployments. Leave the old one alone.
5. Verify the new deployment directly:
   ```
   $env:SHEET_URL="<new production /exec URL>"; $env:SHEET_KEY="<production key>"; node scripts/verify-sheet-endpoint.mjs
   ```
   You need five PASS lines and one `owner-verify` row in production `Usage`. Clean usage already excludes `owner-`
   visitors, so the row can stay or be deleted. Close the window afterwards.
6. Vercel → Environment Variables → **Production**:
   - Write down the current `ADEYIQ_SHEET_URL` value in your password manager as "old /exec (rollback)".
   - Set `ADEYIQ_SHEET_URL` = the new URL and add `ADEYIQ_SHEET_KEY` = the production key.
   - Do not redeploy yet. The live deployment keeps its old values until the next deploy.
7. Set Preview back to the test endpoint, or remove the Preview values, so that preview builds never write to
   production.
8. Mark the PR ready for review and merge it. Vercel builds `main` with the new code and the new values together.
9. Within 5 minutes of the deploy turning Ready:
   - `https://adeyiq.vercel.app/api/health` → `ok: true, sheetConfigured: true`.
   - Open `/build?owner=1` → a new Usage row with an `owner-` visitor.
   - Send one access request with your own details → a row plus an email. Delete the test row afterwards if you like.
   - Check the response headers of `/build`: there is one `Content-Security-Policy` and it contains no
     `'unsafe-inline'` under `script-src`. On the live site, also load a sample, upload an `.xlsx` file and print a
     build sheet.
   - Check Vercel → Logs for `/api/track` errors.
10. Leave the old Apps Script deployment active for about a week as the rollback target. After that, Manage
    deployments → Archive the old one. The old URL then stops working. That is what closes the unsigned-write hole for
    good, because until then anyone who has the old URL can still write unsigned rows. Do this step on purpose and
    soon: it is the security payoff.

## 4. Rollback

| Situation | Action | Effect |
|---|---|---|
| Problem found during Stage A or step 5 of Stage B | Do nothing in Vercel. Optionally archive the new deployment. | Production never changed. |
| Problem after the merge (writes failing, page broken, CSP blocking something) | Vercel → Deployments → previous production deployment → **Instant Rollback** | Previous code with its own environment snapshot (old URL, unsigned). Writes resume at once, because the old Apps Script deployment is still active. |
| Need to stay rolled back for more than a moment | Also set Production `ADEYIQ_SHEET_URL` back to the old URL saved in step 6 | Keeps the next accidental deploy from using the new values with old code. Old code ignores `ADEYIQ_SHEET_KEY`. |
| Code fix needed | Fix on a branch, PR, merge | Promote again after the checks in step 9 |

Confirm every rollback the same way as a release: one new Usage row from `/build?owner=1`.

Do **not** archive the old Apps Script deployment, or delete `ADEYIQ_KEY`, while a rollback might still be needed.

Instant Rollback does not revert environment variables in the project settings. It reuses the old deployment's
snapshot, which is why the table above has the extra step.

## 5. CI on GitHub vs local results

- **Pull request:** <https://github.com/Asnakegi/adeyiq/pull/6>, created by the owner, open and not merged.
- Workflow `.github/workflows/ci.yml` runs on `pull_request` and on pushes to `main`.
- **Local results at `5099c74`** (Windows 11, Node 26.13 locally; CI uses Node 24):

| Check | Local |
|---|---|
| `npm run check:scripts` (all inline scripts + `.gs` parse) | 11/11 files |
| `npm run lint` | 0 errors, 4 warnings (known unused variables) |
| `npm run typecheck` | pass |
| `npm test` (API, Apps Script behaviour, engine, oversize) | 42/42, oversize pass |
| `npm run build` | pass |
| `npm run test:e2e` (next start + mock sheet running the real `.gs` + headless Chrome) | 105/105 |
| `npm audit` | 0 vulnerabilities |

Differences to watch for on CI (Ubuntu):

- Line endings. On Windows, Git checks files out with CRLF. The CSP hashes normalise CRLF to LF, the same way the
  HTML parser does, so the hashes match both ways. `public/vendor/**` is marked `-text`, so the SheetJS checksum is
  the same on both.
- Node version. Local runs used Node 26.13; CI pins Node 24, the project's target. Both strip TypeScript natively for
  `node --test`.
- Chrome. CI uses the runner's preinstalled Chrome, locally the desktop Chrome; both run headless over CDP.
- The e2e CSP checks read real response headers, so a mismatch would fail loudly. It would not pass silently.

**CI result (pull request 6, commit `25da7d7`, run 44508658305): success.** On ubuntu-latest with Node 24, every
step passed: `npm ci`, lint, typecheck, check:scripts, `npm test`, build, `test:e2e` and
`npm audit --omit=dev --audit-level=high`. Differences from the local run:
- CI's audit covers only production dependencies at level high or above. Locally the full `npm audit` (dev included)
  reported 0.
- The per-test counts (42 unit, 105 e2e) come from the local run. GitHub only shows job logs to signed-in users, so the
  CI counts were not read. The CI steps would fail on any failing test, and all of them passed.
- `25da7d7` differs from the tested `5099c74` only by report files.

## 6. CacheService, quotas and logging: what is best effort

| Control | Store | Guarantee | Limitation |
|---|---|---|---|
| Signature + key length ≥ 32 | code | Hard. Fails closed, constant-time compare. | Only as strong as the key's secrecy (Vercel + Script properties). |
| ±5 min timestamp | code | Hard | Needs roughly correct clocks (Vercel and Google both use NTP). |
| Replay (nonce) | CacheService, 10 min | **Best effort.** Google can evict entries early. | An evicted nonce can be replayed until its 5-minute timestamp window closes, which means duplicate rows, not new data. A replay needs a captured request, and requests travel over TLS between Vercel and Google. |
| 120 writes/min global | CacheService | **Best effort** | Eviction can let one minute exceed 120. It is also global, so a flood from a key holder blocks real visitors for that minute. |
| 50 emails/day | Script properties, per UTC day | Persistent. Test proves it survives a cache clear and resets the next day. | Old day keys are deleted. The Google account's own Gmail quota (about 100 a day on a consumer account) still applies on top. |
| Serialisation | `LockService` script lock, 10 s wait | Check-and-store is atomic | Under heavy load, waits over 10 s fail. Vercel retries (`toSheetRetry`, 4 tries), but may drop the event. |
| Apps Script quotas | Google | none | About 30 concurrent executions, about 6 min per execution, and daily URL-fetch and trigger limits. Usage events can be lost at peaks. That is acceptable for analytics. Access requests show the copy-and-send fallback on failure. |
| Vercel rate limits (60/min track, 5/h request per IP) | memory per instance | **Best effort** | Each serverless instance counts separately. |

**Logging.** `doPost` logs only fixed reasons (`bad signature`, `stale`, `replay`, `flood cap`, `bad request`,
`ADEYIQ_KEY is missing or shorter…`). Errors are logged as `AdeyIQ write failed at step "<lock|verify|append
usage|append request|email>" (<error type>)`. `err.message` is never logged, because Google errors can include an
email address or cell content. Tests check that the logs never contain the key, the visitor ID or the email address
from a failing `MailApp` call. On the Vercel side, the API routes log only fixed messages (for example "could not be written to the sheet after retries" or
"ADEYIQ_SHEET_KEY is missing or shorter than 32 characters"). The URL
and key are never logged.

## 7. CSP evaluation (done in this release)

| Option | Verdict |
|---|---|
| **Hashes** (chosen) | Every inline `<script>` in `public/adeyiq/*.html` is hashed at build time in `next.config.ts` from the files that are served, so a change to a page can never leave a stale hash behind. Product paths get `script-src 'self' 'sha256-…'` (8 hashes) with no `'unsafe-inline'`. Checked first: the pages have no inline event handlers (`onclick=`), no `javascript:` links and no `eval`/`new Function`. The builder was tested fully under the new policy (sample → 9 ULDs, Balanced ✓, xlsx upload in the worker, print), and e2e checks all 5 pages. |
| Nonces | Would need every static page rendered per request (middleware rewriting HTML) and makes caching harder. No gain over hashes for static files. |
| External `.js` files | Also good, but it means moving about 1,500 lines of builder code and changing every page and test. Worth doing later as part of splitting `build.html`. |

What remains:

- `style-src` still allows `'unsafe-inline'`, because the pages use 94 `style=""` attributes. Inline styles cannot run
  script, but they allow some CSS-based data probing if an injection ever happened. All user text passes through
  `esc()`, and e2e tests hostile CSV names.
- The Next.js demo pages (`/dashboard`, `/flights`, …) keep `'unsafe-inline'`, because Next injects inline bootstrap
  scripts there. They hold only invented data.
- The legacy optimizer (`/adeyiq_cargo_optimizer_v3|v4.html`, shown inside `/optimizer`) keeps `unsafe-inline` plus
  cdnjs.
- On **Preview** deployments, the Vercel toolbar script is blocked by the product CSP. That is harmless and expected,
  and it does not happen in Production.

## 8. Remaining confidentiality risks (after this release)

| Risk | Level | Note |
|---|---|---|
| claude.ai artifacts (`adeyiq-builder.html`, etc.) save and share shipment data through `window.claude` db/mcp, and can append to Google Sheets | **High** | Not part of this release. See `ARTIFACT_REMEDIATION_PLAN.md`. Nothing was changed or published. Needs the owner's decision. |
| Old unsigned Apps Script deployment stays active until archived (Stage B step 10) | Medium, temporary | Anyone with the old URL can write unsigned rows. They cannot read the sheet. Archive it once you no longer need rollback. |
| Apps Script URL is "Anyone" | Low (after signing) | Required for Vercel. Without the key, writes are refused. Nothing can be read through it. |
| Key held in two places (Vercel, Script properties) | Low | Rotate by setting a new key in both places, Apps Script first, then Vercel plus a redeploy. Writes fail for the minutes in between unless you use the new-deployment method above. |
| Free-text fields (access-request message, feedback comment) can contain personal data typed by visitors | Low–Medium | Stored in the sheet, which must stay **Restricted** sharing (owner to confirm). Formula injection is neutralised. |
| Best-effort rate limits | Low | Analytics can be polluted slowly. |
| Public repository | Low | Reports describe weaknesses, but contain no secrets, URLs or sheet IDs. Decide whether to keep them after the release. |
| Customer manifests in the builder | Low | Parsed only in the browser, stored in that browser's localStorage, and never sent to the server. Shared computers keep them until cleared. |

No system can be called unhackable. These controls reduce the risk, but they do not guarantee that data cannot leak.
