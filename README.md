# AdeyIQ

Cargo build-up and load planning for airline cargo teams. Live at https://adeyiq.vercel.app.

| Path | What it is |
|---|---|
| `/` | Product home page with the access request form (`public/adeyiq/home.html`) |
| `/build` | Cargo Builder: add or upload shipments, build ULDs, load the aircraft (`public/adeyiq/build.html`) |
| `/hold-view`, `/aircraft-data` | Hold view demo and aircraft reference data |
| `/privacy` | What the site collects |
| `/dashboard` and other App Router pages | Early dashboard prototype with invented sample data, marked noindex |
| `/measure` | Phone and tablet page for warehouse staff: measure one piece and send L/W/H to the planner (`public/adeyiq/measure.html`) |
| `/api/track`, `/api/request` | Usage events and access requests, written to the Google Sheet |
| `/api/measure` | Measurement requests: created in `/build`, read and answered on `/measure` (`lib/measure.ts`) |
| `/api/health` | Health check for uptime monitors |

## Run locally

Needs Node.js 24 or later.

```bash
npm ci
npm run dev
```

Without `ADEYIQ_SHEET_URL` nothing is written anywhere: usage events are dropped and the access form shows its copy-and-send fallback. To test writes, point it at a mock, never at the production sheet.

Measurement requests use an in-memory store under `npm run dev` (lost on restart, one server only). To try them from a phone on the same network, the page needs a secure address for the clipboard and to avoid browser warnings: `npx next dev --experimental-https -H 0.0.0.0` (self-signed certificate, so the phone warns once), open the builder at `https://<this computer's LAN address>:3000/build` so the link carries that address, and open the link on the phone. Production needs Upstash Redis (see docs/operations.md).

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
