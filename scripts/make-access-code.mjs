// Makes an access code for Module 2 (Optimize revenue) and the hash to put in Vercel. Run on your own computer:
//   node scripts/make-access-code.mjs              → a new random code and its hash
//   node scripts/make-access-code.mjs ADQ-ABCD-EFGH → the hash of a code you chose
// Give the code to the person (WhatsApp, email). Put only the HASH in Vercel → Settings → Environment Variables →
// ADEYIQ_ACCESS_CODES (Production), separated by commas when there are several, then redeploy. To stop a code, remove
// its hash. Never commit codes or hashes.
import { createHash, randomInt } from "node:crypto";

const ABC = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const norm = (c) => String(c).toUpperCase().replace(/[\s-]+/g, "");
const part = () => Array.from({ length: 4 }, () => ABC[randomInt(ABC.length)]).join("");
const code = process.argv[2] || `ADQ-${part()}-${part()}`;
if (norm(code).length < 8) { console.error("Use a code of at least 8 letters or digits."); process.exit(2); }
const hash = createHash("sha256").update(norm(code), "utf8").digest("hex");
console.log(`Code (give this to the person): ${code}`);
console.log(`Hash (put this in ADEYIQ_ACCESS_CODES): ${hash}`);
