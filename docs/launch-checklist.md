# AdeyIQ launch-readiness checklist

Working checklist for the public launch audit (branch `launch-readiness`). Each item has an acceptance
criterion; the final status and evidence are in [launch-readiness-report.md](launch-readiness-report.md).

## What the product is (as audited)

- **Stack:** Next.js 16 on Vercel. Public product pages are static HTML in `public/adeyiq/` served through
  rewrites (`/`, `/build`, `/hold-view`, `/aircraft-data`). An older demo dashboard (App Router pages:
  `/dashboard`, `/flights`, `/shipments`, `/uld`, `/3dview`, `/planning`, `/optimizer`, `/dg`, `/reports`,
  `/settings`) is still deployed.
- **Users / roles:** anonymous visitors only. No accounts, no login, no admin UI on the website. The owner
  reads data in the "AdeyIQ Cargo Data" Google Sheet.
- **Data flows:** Cargo Builder runs entirely in the browser; shipments are kept in the visitor's
  `localStorage`. Two server routes forward to a Google Apps Script web app (`ADEYIQ_SHEET_URL`):
  `POST /api/track` (anonymous usage events with country/region/city from Vercel headers) and
  `POST /api/request` (access requests: name, email, company, phone, message → sheet row + email to owner).
- **External services:** Vercel (hosting, geo headers), Google Apps Script + Sheets + Gmail quota,
  Google Fonts, cdnjs (SheetJS for Excel uploads in the browser), jsDelivr.

## Findings and acceptance criteria (priority order)

| # | Priority | Finding | Acceptance criterion |
|---|---|---|---|
| 1 | Critical | `next@16.2.6` has critical/high advisories (middleware bypass, DoS, SSRF, cache confusion) | Next upgraded to a patched 16.x; `npm audit --omit=dev` shows no critical issues in shipped code |
| 2 | High | Unused vulnerable packages in production deps (`axios`, `xlsx`, `three`, `recharts`) | Removed; build and pages unchanged |
| 3 | High | `/api/request` and `/api/track` have no rate limit or origin check: anyone can flood the sheet and the owner's email quota | Per-IP rate limits, same-origin check for browser posts, body-size limits; negative tests prove 403/413/429 |
| 4 | High | Sheet failures are silent (no logs) | Failed writes logged without personal data; `/api/health` reports whether the sheet is configured (no values) |
| 5 | Medium | No security headers | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy` on every response |
| 6 | Medium | Demo dashboard with invented operational data (flights, alerts, DG conflicts) is public and indexable | Clearly labelled as demo data on every page and `noindex`; product pages unaffected |
| 7 | Medium | "✓ Saved" in the builder implies an account; on the website cargo is only stored in this browser | Message says where it is saved |
| 8 | Medium | No privacy notice for the access form, usage tracking and feedback | Factual privacy page linked from every product page; owner decision items listed |
| 9 | Medium | Lint fails (17 errors); no automated tests for the product pages or API; no CI | Lint, type check, unit/API/engine tests and build pass locally and in CI |
| 10 | Medium | Untested core journeys and failure modes | Browser E2E covers add/edit/delete/upload/load/feedback/access request, sheet-down fallback, XSS payload, mobile widths, basic accessibility |
| 11 | Low | No operations docs (deploy, rollback, backups, incident response) | `docs/operations.md` written |
| 12 | Low | Test rows from setup/load tests in the owner's sheet | Listed for the owner to delete (no write/delete access to remove them) |
