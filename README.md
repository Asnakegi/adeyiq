# AdeyIQ

Cargo build-up and load planning for airline cargo teams. Live at https://adeyiq.vercel.app.

| Path | What it is |
|---|---|
| `/` | Product home page with the access request form (`public/adeyiq/home.html`) |
| `/build` | Cargo Builder: add or upload shipments, build ULDs, load the aircraft (`public/adeyiq/build.html`) |
| `/hold-view`, `/aircraft-data` | Hold view demo and aircraft reference data |
| `/privacy` | What the site collects |
| `/dashboard` and other App Router pages | Early dashboard prototype with invented sample data, marked noindex |
| `/api/track`, `/api/request` | Usage events and access requests, written to the Google Sheet |
| `/api/health` | Health check for uptime monitors |

## Run locally

Needs Node.js 24 or later.

```bash
npm ci
npm run dev
```

Without `ADEYIQ_SHEET_URL` nothing is written anywhere: usage events are dropped and the access form shows its copy-and-send fallback. To test writes, point it at a mock, never at the production sheet.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

`npm test` runs API unit tests, packing-engine regression tests (read straight from `public/adeyiq/build.html`) and the oversize checks. `npm run test:e2e` drives headless Chrome against the local production build with a mock sheet.

## More

- [docs/operations.md](docs/operations.md): deploy, rollback, environment variables, backups, monitoring, incidents
- [docs/launch-checklist.md](docs/launch-checklist.md): launch findings and acceptance criteria
- [docs/launch-readiness-report.md](docs/launch-readiness-report.md): latest launch-readiness review
