/**
 * AdeyIQ website → "AdeyIQ Cargo Data" Google Sheet.
 *
 * Paste this into the Apps Script editor of the sheet (Extensions → Apps Script — NOT into the cells),
 * then Deploy → New deployment → Web app:  Execute as: Me   Who has access: Anyone.
 * Put the web app URL (ends in /exec) in Vercel as ADEYIQ_SHEET_URL. Never publish it.
 *
 * Shared secret (recommended): Project Settings → Script properties → add ADEYIQ_KEY = a long random value,
 * and set the same value in Vercel as ADEYIQ_SHEET_KEY (Production and Preview), then redeploy both.
 * Once ADEYIQ_KEY is set, writes without the key are refused, even from someone who knows the /exec URL.
 *
 *   type "request" → one row in "Access requests" + an email to you
 *   type "usage"   → one row in "Usage" (page opens and tool actions, with country and city)
 */
const NOTIFY = true; // false = no email for each access request

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const key = PropertiesService.getScriptProperties().getProperty('ADEYIQ_KEY');
    if (key && d.key !== key) return out({ ok: false });
    /* text that a spreadsheet could read as a formula is stored as plain text */
    const clip = (v, n) => String(v == null ? '' : v).replace(/^[=+\-@\t\r]/, "'    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const clip = (v, n) => String(v == null ? '' : v).replace(/^[=+\-@]/, "'$&").slice(0, n);").slice(0, n);
    if (d.type === 'usage') {
      append('Usage', [new Date(), clip(d.event, 40), clip(d.page, 80), clip(d.visitor, 20), clip(d.session, 20),
        clip(d.country, 4), clip(d.region, 60), clip(d.city, 80), clip(d.aircraft, 40), clip(d.detail, 300), clip(d.device, 20), clip(d.ref, 200)]);
      return out({ ok: true });
    }
    if (d.website) return out({ ok: true }); // hidden field filled in: a bot
    const email = clip(d.email, 200);
    if (!clip(d.name, 200) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out({ ok: false, error: 'name and email are required' });
    const row = [new Date(), clip(d.name, 200), email, clip(d.company, 200), clip(d.phone, 60),
      clip([].concat(d.modules || []).join(', '), 200), clip(d.message, 2000), clip(d.page, 200), 'New'];
    append('Access requests', row);
    if (NOTIFY) {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'AdeyIQ access request: ' + row[1],
        ['Name: ' + row[1], 'Email: ' + row[2], 'Company: ' + (row[3] || '-'), 'Phone: ' + (row[4] || '-'),
         'Modules: ' + row[5], 'Message: ' + (row[6] || '-'), 'Location: ' + (row[7] || '-'), '',
         'All requests: ' + SpreadsheetApp.getActive().getUrl()].join('\n'));
    }
    return out({ ok: true });
  } catch (err) {
    console.error(err); // visible to the owner under Executions; callers get no internal details
    return out({ ok: false });
  }
}

function append(tab, row) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { SpreadsheetApp.getActive().getSheetByName(tab).appendRow(row); } finally { lock.releaseLock(); }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
