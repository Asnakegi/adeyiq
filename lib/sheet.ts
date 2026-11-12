/**
 * Where usage events and access requests are sent: the Apps Script web app of the
 * "AdeyIQ Cargo Data" Google Sheet (scripts/access-requests.gs).
 * Required environment variable: ADEYIQ_SHEET_URL (the web app URL ending in /exec). Empty = nothing is sent.
 */
export const SHEET_URL = process.env.ADEYIQ_SHEET_URL || "";

const TIMEOUT_MS = 8000;

export async function toSheet(body: Record<string, unknown>): Promise<boolean> {
  if (!SHEET_URL) return false;
  try {
    const res = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return !!(data && data.ok);
  } catch {
    return false;
  }
}

/**
 * Google Apps Script handles only a limited number of writes at the same moment; extra ones time out.
 * Retry a failed write a few times with growing, random delays so bursts of visitors are not lost.
 */
export async function toSheetRetry(body: Record<string, unknown>, tries = 4): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (await toSheet(body)) return true;
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 600 * 2 ** i + Math.random() * 900));
  }
  return false;
}
