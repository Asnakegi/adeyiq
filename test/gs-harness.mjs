// Runs the real scripts/access-requests.gs in Node with small stand-ins for the Google services it uses,
// so unit tests and the end-to-end mock sheet exercise the code that is pasted into Apps Script.
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

const SRC = new URL("../scripts/access-requests.gs", import.meta.url);

export function loadGs({ key = "", now = () => Date.now(), mailError = "" } = {}) {
  const appended = [], mails = [], logs = [], cache = new Map(), props = new Map();
  const sandbox = {
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [now()])); } static now() { return now(); } },
    console: { warn: (m) => logs.push(["warn", String(m)]), error: (m) => logs.push(["error", String(m)]), log: (m) => logs.push(["log", String(m)]) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k === "ADEYIQ_KEY" ? (key || null) : props.has(k) ? props.get(k) : null), setProperty: (k, v) => props.set(k, String(v)), deleteProperty: (k) => props.delete(k), getKeys: () => [...props.keys()] }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => cache.set(k, String(v)) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      computeHmacSha256Signature: (value, k) => [...crypto.createHmac("sha256", k).update(value).digest()].map((b) => (b > 127 ? b - 256 : b)),
      base64Encode: (bytes) => Buffer.from(bytes.map((b) => b & 255)).toString("base64"),
    },
    SpreadsheetApp: { getActive: () => ({ getSheetByName: (tab) => ({ appendRow: (row) => appended.push({ tab, row }) }), getUrl: () => "https://docs.google.com/spreadsheets/d/TEST" }) },
    MailApp: { sendEmail: (to, subject, body) => { if (mailError) throw new Error(mailError); mails.push({ to, subject, body }); } },
    Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.test" }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (s) => ({ text: s, setMimeType() { return this; } }) },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(SRC, "utf8"), sandbox, { filename: "access-requests.gs" });
  const doPost = (body) => JSON.parse(sandbox.doPost({ postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } }).text);
  return { doPost, appended, mails, logs, cache, props };
}

/** Same signing as lib/sheet.ts signEnvelope (kept independent on purpose, so a mismatch shows up in tests). */
export function sign(data, key, ts = Date.now(), nonce = crypto.randomBytes(18).toString("base64url")) {
  const payload = JSON.stringify(data);
  return { v: 1, ts, nonce, payload, sig: crypto.createHmac("sha256", key).update(`${ts}.${nonce}.${payload}`).digest("base64") };
}
