/**
 * AdeyIQ access requests → Google Sheet.
 *
 * Paste this into the Apps Script editor of the "AdeyIQ Cargo Data" sheet
 * (Extensions → Apps Script), then Deploy → New deployment → Web app:
 *   Execute as: Me    Who has access: Anyone
 * Copy the web app URL (ends in /exec) into REQ_URL in public/adeyiq/home.html.
 *
 * Every request from adeyiq.vercel.app becomes one row in the "Access requests" tab,
 * and you get an email for each one.
 */
const TAB = 'Access requests';
const NOTIFY = true; // set to false to stop the email for each request

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return out({ ok: true }); // hidden field filled in: a bot
    const clip = (v, n) => String(v == null ? '' : v).replace(/^[=+\-@]/, "'$&").slice(0, n);
    const email = clip(d.email, 200);
    if (!clip(d.name, 200) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return out({ ok: false, error: 'name and email are required' });
    const row = [new Date(), clip(d.name, 200), email, clip(d.company, 200), clip(d.phone, 60),
      clip([].concat(d.modules || []).join(', '), 200), clip(d.message, 2000), clip(d.page, 200), 'New'];
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try { SpreadsheetApp.getActive().getSheetByName(TAB).appendRow(row); } finally { lock.releaseLock(); }
    if (NOTIFY) {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'AdeyIQ access request: ' + row[1],
        ['Name: ' + row[1], 'Email: ' + row[2], 'Company: ' + (row[3] || '-'), 'Phone: ' + (row[4] || '-'),
         'Modules: ' + row[5], 'Message: ' + (row[6] || '-'), '', 'All requests: ' + SpreadsheetApp.getActive().getUrl()].join('\n'));
    }
    return out({ ok: true });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
