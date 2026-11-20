// Builds public/adeyiq/un-list.json for the builder's "DG acceptance" check.
// Source: US Hazardous Materials Table, 49 CFR 172.101 (US government work, public domain), read from the eCFR API.
// It is used as a free stand-in for the IATA List of Dangerous Goods, which cannot be copied. Differences exist:
// the app labels the result as a planning aid and asks staff to confirm in the IATA DGR.
//
// Run: node scripts/build-un-list.mjs [YYYY-MM-DD | path/to/saved.xml]
import fs from "node:fs";

const arg = process.argv[2] || "2025-10-01";
const xml = /\.xml$/i.test(arg)
  ? fs.readFileSync(arg, "utf8")
  : await (async () => {
      const url = `https://www.ecfr.gov/api/versioner/v1/full/${arg}/title-49.xml?part=172&section=172.101`;
      const r = await fetch(url, { headers: { "Accept-Encoding": "gzip" } });
      if (!r.ok) throw new Error(`eCFR ${r.status} for ${url}`);
      return r.text();
    })();

const clean = (s) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#[0-9]+;/g, " ").replace(/\s+/g, " ").trim();

const out = {};
let cur = null; // last full entry, for the extra packing-group rows that leave name and UN number blank
for (const tr of xml.split(/<TR[^>]*>/).slice(1)) {
  const td = [...tr.split("</TR>")[0].matchAll(/<TD[^>]*>([\s\S]*?)(?=<TD|$)/g)].map((m) => clean(m[1]));
  if (td.length !== 14) continue;
  // columns: 0 symbols, 1 name, 2 class, 3 id, 4 PG, 5 labels, 6 special prov., 7-9 packaging, 9A pax, 9B CAO, 10A/B vessel
  let [sym, name, cls, id, pg, labels, , , , , pax, cao] = td;
  if (id) cur = { sym, name, cls, id };
  else if (!name && cur && pg) ({ sym, name, cls, id } = cur);
  else { cur = null; continue; }
  if (!/^UN\d{4}$/.test(id)) continue; // NA numbers are US-only
  if (/D/.test(sym)) continue; // US domestic-only entries
  (out[id] ||= []).push([name, cls, pg, labels === "None" ? "" : labels, pax, cao]);
}

// Entries the US table does not have yet. Limits mirror the lithium-ion entries; marked so the app asks staff to check them.
const EXTRA = {
  UN3551: [["Sodium ion batteries (check in DGR)", "9", "", "9", "Forbidden", "35 kg"]],
  UN3552: [["Sodium ion batteries contained in or packed with equipment (check in DGR)", "9", "", "9", "5 kg", "35 kg"]],
};
for (const [k, v] of Object.entries(EXTRA)) out[k] ||= v;

const ids = Object.keys(out).sort();
const data = { src: `US 49 CFR 172.101 Hazardous Materials Table (eCFR ${/\.xml$/i.test(arg) ? "saved copy" : arg})`, n: ids.length, d: Object.fromEntries(ids.map((k) => [k, out[k]])) };
const file = new URL("../public/adeyiq/un-list.json", import.meta.url);
fs.writeFileSync(file, JSON.stringify(data));
console.log(`${ids.length} UN numbers, ${(fs.statSync(file).size / 1024).toFixed(0)} KB -> public/adeyiq/un-list.json`);
