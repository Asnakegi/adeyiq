/* Reads an uploaded Excel file in a background worker, so a malformed or hostile file cannot freeze the Cargo Builder.
   The page stops this worker if it takes too long. Only the first sheet's cell text comes back: no formulas, HTML,
   styles or macros. Nothing leaves the browser. */
importScripts("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");
onmessage = function (e) {
  try {
    var wb = XLSX.read(e.data.buf, { type: "array", cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false, sheetRows: e.data.rows });
    var ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new Error("no sheet");
    postMessage({ rows: XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) });
  } catch {
    postMessage({ error: true });
  }
};
