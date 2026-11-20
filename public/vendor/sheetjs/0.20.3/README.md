# SheetJS Community Edition 0.20.3 (self-hosted)

- Source: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz (official SheetJS distribution; the npm registry and
  cdnjs only carry the outdated 0.18.5). File: `package/dist/xlsx.full.min.js`.
- License: Apache-2.0 (copy in `LICENSE`, from the same package).
- SHA-256: `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41`
- Subresource Integrity: `sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT`
- Verified 19 November 2026: the file inside the release package and the file downloaded directly from
  https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js are identical (same SHA-256).
- Fixes CVE-2023-30533 (prototype pollution, fixed in 0.19.3) and CVE-2024-22363 (ReDoS, fixed in 0.20.2).
- Used only by `public/adeyiq/xlsx-worker.js` to read uploaded Excel files in the browser. Nothing is sent anywhere.
- To update: download the new release from cdn.sheetjs.com, compare hashes as above, add a new versioned folder, update
  the worker path and this file, and run `npm test` and `npm run test:e2e`.
