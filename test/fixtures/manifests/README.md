# Sample manifests (synthetic)

Made-up files in the layouts real cargo manifests use. No real customer data: every AWB, name and weight is invented.
`test/engine.test.mjs` imports each one and checks the result; `test/e2e.mjs` uploads some of them in the browser.
The `.xlsx` files are made from the `.json` files (rows as arrays) by `node test/fixtures/manifests/make-xlsx.mjs`.

| File | What is messy about it |
| --- | --- |
| `title-rows-semicolon.csv` | company / flight lines above the header, `;` separator, `1.234,5` weights, chargeable weight column, mixed dim notations, a total line |
| `multi-dims.csv` | several sizes in one cell (`2/120x80x60, 1/60x40x40`, `2 @ ...`), `3 pcs`, `990 lbs`, volume column |
| `no-header.csv` | no header row at all: columns are guessed from content |
| `lwh-tabs.tsv` | tab separated, `L (cm)` / `W (cm)` / `H (cm)`, weight per piece on some lines, a repeated header (page break) |
| `merged-awb.json` → `.xlsx` | title rows, two-row header (`Dimensions (cm)` over `L W H`), blank cells under an AWB (merged cells), empty column and rows |
| `inches-lbs.json` → `.xlsx` | `Dims (in)`, `Weight (lbs)`, `Nature & quantity of goods`, `Pkgs`, sizes as `L47 W31 H24` |
| `piece-list.csv` | charter request: one row per piece, a "Piece ID" column (a label, not a count), no AWB, a totals block above the table |
