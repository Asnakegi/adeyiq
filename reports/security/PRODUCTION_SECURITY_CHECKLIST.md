# Production security checklist

For the owner. Nothing here has been changed in production by the audit.

## Before or right after merging `security-audit`
- [ ] Review and merge the pull request. Vercel deploys `main`.
- [ ] Check `https://adeyiq.vercel.app/api/health` → `ok: true, sheetConfigured: true`.
- [ ] Open `/build?owner=1`, upload a small Excel file, and confirm it loads (the new worker).
- [ ] In the Usage tab, confirm new rows show status only (e.g. "9 ULDs built"), with no kg.

## claude.ai artifacts (finding A-1, highest priority)
- [ ] List who can open the claude.ai artifacts "AdeyIQ Cargo Builder" and "AdeyIQ Modules". If anyone other than you
      has the link, stop sharing them.
- [ ] Decide: delete those artifacts, keep them private, or republish them without the shared database and Sheets
      writes (ask Claude to do this; it needs your approval to publish).
- [ ] In the Google Sheet, check the tabs "Shipments", "ULD builds" and "Load plans". If they hold other people's
      cargo, delete those rows or tabs (keep a private copy first if needed).

## Google Apps Script (A-5, A-8)

> **Superseded by `RELEASE_READINESS.md` sections 2–4:** a separate test endpoint, then a *new* production deployment,
> with no write gap and rollback by Vercel Instant Rollback. Use those steps, not the "edit the existing deployment"
> steps below. The items below stay as a reference for what must be true afterwards.

- [ ] The new script **fails closed**: set `ADEYIQ_KEY` (Apps Script) and `ADEYIQ_SHEET_KEY` (Vercel), both the same and at least 32 characters, **before** merging, or recording stops.
- [ ] Open the sheet → Extensions → Apps Script. Replace the code with `scripts/access-requests.gs` from `main`.
- [ ] Project Settings → Script properties → add `ADEYIQ_KEY` = a long random value (e.g. 40+ characters from a
      password generator). Never paste it into chat, code or the sheet.
- [ ] Vercel → Settings → Environment Variables → add `ADEYIQ_SHEET_KEY` with the same value (Production and Preview).
- [ ] Deploy → Manage deployments → edit the existing web app → New version → Deploy (same `/exec` URL).
- [ ] Redeploy on Vercel, then check that a new Usage row appears. If none appears, the two values differ.
- [ ] Confirm the web app settings: Execute as **Me**, Who has access **Anyone** (needed for Vercel). The secret, not
      the access setting, is what protects writes.
- [ ] Executions page: check for unexpected errors or unusual volume weekly.

## Google Sheets access controls
- [ ] Share → General access must be **Restricted** (not "Anyone with the link"). The spreadsheet ID has appeared in
      public code, so "Anyone with the link" would expose access requests and feedback.
- [ ] People with access: only you (and anyone you deliberately add).
- [ ] File → Version history works; make a private copy monthly (`docs/operations.md`).
- [ ] Set a retention period for Usage and Access requests rows, and update `/privacy`.

## Secret rotation
- [ ] **No exposed credentials were found**, so nothing must be rotated now.
- [ ] Rotate the Apps Script URL (new deployment → update `ADEYIQ_SHEET_URL`) only if spam rows appear or the URL was
      shared by mistake. The `/exec` URL was once pasted into a chat with Claude (not into code); consider a new
      deployment as a precaution after the shared secret is in place.
- [ ] If `ADEYIQ_KEY` is ever exposed: change it in both places the same day.

## Vercel configuration
- [ ] Environment variables: `ADEYIQ_SHEET_URL` and `ADEYIQ_SHEET_KEY` only; `ADEYIQ_TRACK_PER_MIN` must **not** be set.
- [ ] Deployment Protection: keep Vercel Authentication on for Preview deployments.
- [ ] Team members: only people who need access; two-factor authentication on the Vercel and GitHub accounts.
- [ ] Optional: Vercel Firewall rate rule for `/api/*` if abuse appears.

## Security headers (live, verified 19 Nov)
- [x] Strict-Transport-Security (preload) · [x] CSP · [x] X-Content-Type-Options · [x] X-Frame-Options and
      frame-ancestors · [x] Referrer-Policy · [x] Permissions-Policy
- [ ] After merge, confirm `script-src` no longer lists `cdn.jsdelivr.net`.

## Dependencies and supply chain
- [x] SheetJS 0.20.3 self-hosted under `public/vendor/sheetjs/0.20.3/` with license and hashes (revision 2).
- [ ] When SheetJS publishes a newer release, update it the same way (see its README).
- [ ] Add Subresource Integrity, or self-host, for any remaining CDN script.
- [ ] GitHub: enable Dependabot alerts, secret scanning and push protection; protect `main` (require CI, no force pushes).
- [ ] Pin GitHub Actions to commit SHAs instead of `@v4` tags.
- [ ] Keep Next.js on patched 16.x releases; run `npm audit --omit=dev` monthly.

## Monitoring
- [ ] Uptime monitor on `/api/health` (5 min).
- [ ] Vercel logs: filter `[track]` and `[request]` warnings weekly.
- [ ] Weekly report (Monday task) for unusual spikes in Usage rows or access requests.
