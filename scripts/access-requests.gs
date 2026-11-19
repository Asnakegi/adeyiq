/**
 * AdeyIQ website → "AdeyIQ Cargo Data" Google Sheet.
 *
 * Paste this into the Apps Script editor of the sheet (Extensions → Apps Script — NOT into the cells).
 * Deploy → Manage deployments → Web app: Execute as: Me   Who has access: Anyone (Vercel must be able to call it).
 * Put the web app URL (ends in /exec) in Vercel as ADEYIQ_SHEET_URL. Never publish it.
 *
 * Authentication (required, fails closed):
 *   Project Settings → Script properties → ADEYIQ_KEY = a random value of at least 32 characters.
 *   Vercel → Environment Variables → ADEYIQ_SHEET_KEY = the same value (Production and Preview).
 *   Without ADEYIQ_KEY (or with a shorter one) every write is refused.
 * Every write from the website is an envelope {v:1, ts, nonce, payload, sig} where
 *   sig = base64(HMAC-SHA256(ADEYIQ_KEY, ts + "." + nonce + "." + payload)) and payload is the JSON row data.
 * Refused: missing or wrong signature, timestamps older or newer than 5 minutes, a nonce seen in the last 10 minutes
 * (replay), more than 120 writes a minute in total (flood cap). Rejections are logged without secrets or row data.
 *
 *   type "request" → one row in "Access requests" + an email to you (at most 50 emails a day)
 *   type "usage"   → one row in "Usage" (page opens and tool actions, with country and city)
 */
const NOTIFY = true; // false = no email for each access request
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_WRITES_PER_MINUTE = 120;
const MAX_EMAILS_PER_DAY = 50;
const MAX_PAYLOAD = 10000;

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const auth = verify_(e);
    if (!auth.ok) { console.warn('AdeyIQ write refused: ' + auth.why); return out_({ ok: false }); }
    if (!underLimit_()) { console.warn('AdeyIQ write refused: more than ' + MAX_WRITES_PER_MINUTE + ' writes this minute'); return out_({ ok: false }); }
    const d = auth.data;
    if (d.type === 'usage') {
      append_('Usage', [new Date(), clip_(d.event, 40), clip_(d.page, 80), clip_(d.visitor, 20), clip_(d.session, 20),
        clip_(d.country, 4), clip_(d.region, 60), clip_(d.city, 80), clip_(d.aircraft, 40), clip_(d.detail, 300), clip_(d.device, 20), clip_(d.ref, 200)]);
      return out_({ ok: true });
    }
    if (d.type !== 'request') return out_({ ok: false });
    if (d.website) return out_({ ok: true }); // hidden field filled in: a bot
    const email = clip_(d.email, 200);
    if (!clip_(d.name, 200) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out_({ ok: false });
    const row = [new Date(), clip_(d.name, 200), email, clip_(d.company, 200), clip_(d.phone, 60),
      clip_([].concat(d.modules || []).join(', '), 200), clip_(d.message, 2000), clip_(d.page, 200), 'New'];
    append_('Access requests', row);
    if (NOTIFY && mailBudget_()) {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'AdeyIQ access request: ' + row[1],
        ['Name: ' + row[1], 'Email: ' + row[2], 'Company: ' + (row[3] || '-'), 'Phone: ' + (row[4] || '-'),
         'Modules: ' + row[5], 'Message: ' + (row[6] || '-'), 'Location: ' + (row[7] || '-'), '',
         'All requests: ' + SpreadsheetApp.getActive().getUrl()].join('\n'));
    }
    return out_({ ok: true });
  } catch (err) {
    // only the error message, never the request body or the key; callers get no details
    console.error('AdeyIQ write failed: ' + String((err && err.message) || err).slice(0, 200));
    return out_({ ok: false });
  } finally {
    try { lock.releaseLock(); } catch (ignore) { /* lock was not taken */ }
  }
}

/* Checks the signed envelope. Fails closed: no key configured means no write is accepted. */
function verify_(e) {
  const key = PropertiesService.getScriptProperties().getProperty('ADEYIQ_KEY');
  if (!key || key.length < 32) return { ok: false, why: 'ADEYIQ_KEY is missing or shorter than 32 characters' };
  const raw = (e && e.postData && e.postData.contents) || '';
  if (!raw || raw.length > MAX_PAYLOAD + 400) return { ok: false, why: 'empty or oversized body' };
  let env;
  try { env = JSON.parse(raw); } catch (bad) { return { ok: false, why: 'body is not JSON' }; }
  if (!env || env.v !== 1 || typeof env.payload !== 'string' || typeof env.sig !== 'string' || typeof env.ts !== 'number' ||
      typeof env.nonce !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(env.nonce) || env.payload.length > MAX_PAYLOAD) {
    return { ok: false, why: 'missing or malformed signature envelope' };
  }
  if (Math.abs(Date.now() - env.ts) > MAX_AGE_MS) return { ok: false, why: 'timestamp outside 5 minutes' };
  const expected = Utilities.base64Encode(Utilities.computeHmacSha256Signature(env.ts + '.' + env.nonce + '.' + env.payload, key));
  if (!safeEqual_(expected, env.sig)) return { ok: false, why: 'signature does not match' };
  const cache = CacheService.getScriptCache();
  if (cache.get('n:' + env.nonce)) return { ok: false, why: 'nonce already used (replay)' };
  cache.put('n:' + env.nonce, '1', 600);
  let data;
  try { data = JSON.parse(env.payload); } catch (bad) { return { ok: false, why: 'payload is not JSON' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, why: 'payload is not an object' };
  return { ok: true, data: data };
}

/* constant-time comparison, so the signature cannot be guessed byte by byte from response times */
function safeEqual_(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/* total writes per minute across all callers (Apps Script does not see the visitor's IP; per-IP limits are in Vercel) */
function underLimit_() {
  const cache = CacheService.getScriptCache(), k = 'w:' + Math.floor(Date.now() / 60000);
  const n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), 120);
  return n <= MAX_WRITES_PER_MINUTE;
}

function mailBudget_() {
  const cache = CacheService.getScriptCache(), k = 'm:' + new Date().toISOString().slice(0, 10);
  const n = Number(cache.get(k) || 0) + 1;
  cache.put(k, String(n), 21600);
  return n <= MAX_EMAILS_PER_DAY;
}

/* text that a spreadsheet could read as a formula is stored as plain text */
function clip_(v, n) {
  return String(v == null ? '' : v).replace(/^[=+\-@\t\r]/, function (m) { return "'" + m; }).slice(0, n);
}

function append_(tab, row) {
  SpreadsheetApp.getActive().getSheetByName(tab).appendRow(row);
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
