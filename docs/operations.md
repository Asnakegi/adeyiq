# Operations

How AdeyIQ runs in production, how to change it safely and what to do when something breaks.

## What runs where

| Part | Where | Notes |
|---|---|---|
| Website and API | Vercel project for adeyiq.vercel.app, built from `main` | Static product pages in `public/adeyiq/`, API routes in `app/api/` |
| Data store | Google Sheet "AdeyIQ Cargo Data" | Tabs: Usage, Access requests, Clean usage, Filters, Traffic summary, Feedback |
| Sheet writer | Google Apps Script web app bound to the sheet | Source: `scripts/access-requests.gs` |
| Visitor analytics | Vercel Web Analytics | `/_vercel/insights/script.js`, only exists on Vercel |

Cargo that users enter in the builder stays in their browser (local storage); there is no server copy to back up or lose.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Required | Scope | Purpose |
|---|---|---|---|
| `ADEYIQ_SHEET_URL` | Yes | Production and Preview | Apps Script web app URL ending in `/exec`. Without it, usage is not recorded and the access form shows its copy-and-send fallback (the API answers 503). |

Never commit the value: anyone holding the URL can write rows to the sheet. After changing a variable, redeploy for it to take effect.

## Checks before merging

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm run test:e2e` starts the production build on port 5300 with a mock sheet on port 5301 and drives headless Chrome. It never contacts production. The same steps run in GitHub Actions (`.github/workflows/ci.yml`) on every pull request.

## Deploying

1. Merge a reviewed pull request into `main`. Vercel builds and deploys it automatically.
2. Open `https://adeyiq.vercel.app/api/health`. Expect `{"ok":true,"sheetConfigured":true,...}`.
3. Open `/` and `/build`, load the sample cargo and press Load to aircraft.
4. In the sheet, a new Usage row should appear within a minute. Your own devices are marked with `?owner=1` and are left out of Clean usage.

## Rolling back

Vercel → Deployments → pick the last good deployment → **Instant Rollback** (or "Promote to Production"). This takes effect in seconds and does not need a rebuild. Then revert the bad commit on `main` so the next deploy does not bring it back.

## Changing the Apps Script

1. Edit `scripts/access-requests.gs` in the repo and get it reviewed.
2. In the sheet: Extensions → Apps Script, paste the new code.
3. Deploy → **Manage deployments** → edit the existing web app → Version: New version → Deploy. Editing the existing deployment keeps the same `/exec` URL. Creating a *new* deployment gives a new URL, which must then be put in `ADEYIQ_SHEET_URL` followed by a Vercel redeploy.
4. Check `/api/health` and watch for a new Usage row.

## Backup and restore of the sheet

- Google Sheets keeps version history: File → Version history → See version history. You can restore any earlier version or copy it out.
- For a point-in-time copy before risky changes: File → Make a copy (keep it private).
- Suggested routine: make a copy monthly and before any change to the Apps Script or formulas.

Restoring from version history has **not** been rehearsed for this sheet yet. Do one test restore on a copy before relying on it.

## Monitoring

- **Uptime:** point a free uptime monitor at `https://adeyiq.vercel.app/api/health` (every 5 minutes). Alert if it is not 200 or `sheetConfigured` is false. Monitors whose user agent contains "monitor", "bot" or "pingdom" are ignored by `/api/track`, so they do not count as visitors.
- **Errors:** Vercel → project → Logs. Filter for `[track]` (usage rows lost after 4 retries) and `[request]` (access request not saved, or sheet not configured).
- **Apps Script:** script editor → Executions shows failed runs and quota errors.
- **Quotas:** Apps Script consumer accounts allow about 100 emails a day (one per access request) and limited simultaneous runs. The API rate limits keep normal use well inside these.

## Incidents

| Symptom | Likely cause | What to do |
|---|---|---|
| `/api/health` shows `sheetConfigured:false` | Env var missing in Production | Add `ADEYIQ_SHEET_URL` for Production, redeploy |
| No new Usage rows, health OK | Apps Script deployment changed or failing | Check Apps Script Executions; confirm the `/exec` URL matches the env var |
| Access form shows "ready to send" for everyone | Sheet writes failing (502) | As above. Requests are not lost: users are shown a copy-and-send box |
| Many 429 responses in logs | Burst from one network, or abuse | Usually nothing to do. Limits reset within a minute (usage) or an hour (requests) |
| Junk or spam rows | Someone found the `/exec` URL and is writing directly | Create a new Apps Script deployment (new URL), update the env var, redeploy. Delete the junk rows |
| Site broken after a deploy | Bad release | Instant Rollback (above), then fix forward |

## Data handling

- What is collected is described for users at `/privacy` (`public/adeyiq/privacy.html`). Update that page whenever `track.js`, `lib/api.ts` or the forms change what they send.
- Deletion requests arrive through the access form. Delete the matching rows in Access requests, Usage and Feedback.
- Test rows (visitor ids starting `owner-` or `setup-test`, and the e2e/load-test rows) are filtered out of Clean usage, but should be deleted from the raw Usage tab once no longer needed.
