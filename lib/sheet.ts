import { createHmac, randomBytes } from "node:crypto";

/**
 * Where usage events and access requests are sent: the Apps Script web app of the
 * "AdeyIQ Cargo Data" Google Sheet (scripts/access-requests.gs).
 *
 * Required environment variables (server only, never sent to the browser):
 *   ADEYIQ_SHEET_URL  the web app URL ending in /exec
 *   ADEYIQ_SHEET_KEY  the signing key, at least 32 characters, identical to the script property ADEYIQ_KEY
 * If either is missing nothing is sent (fail closed): access requests answer 503 and usage events are dropped
 * with a log line. The key itself is never logged, returned or put in a URL.
 */
export const SHEET_URL = process.env.ADEYIQ_SHEET_URL || "";
export const SHEET_KEY = process.env.ADEYIQ_SHEET_KEY || "";
export const MIN_KEY_LENGTH = 32;
export const sheetReady = () => !!SHEET_URL && SHEET_KEY.length >= MIN_KEY_LENGTH;
/** Which setting is missing, for server logs (names only, never values). */
export const sheetProblem = () =>
  !SHEET_URL ? "ADEYIQ_SHEET_URL is not set" : SHEET_KEY.length < MIN_KEY_LENGTH ? `ADEYIQ_SHEET_KEY is missing or shorter than ${MIN_KEY_LENGTH} characters` : "";

const TIMEOUT_MS = 8000;

/**
 * Signed envelope the Apps Script verifies: sig = base64(HMAC-SHA256(key, ts + "." + nonce + "." + payload)).
 * The timestamp limits replays to 5 minutes and the single-use nonce blocks replays inside that window.
 */
export function signEnvelope(body: Record<string, unknown>, key = SHEET_KEY, now = Date.now(), nonce = randomBytes(18).toString("base64url")) {
  const payload = JSON.stringify(body);
  const sig = createHmac("sha256", key).update(`${now}.${nonce}.${payload}`).digest("base64");
  return { v: 1, ts: now, nonce, payload, sig };
}

export async function toSheet(body: Record<string, unknown>): Promise<boolean> {
  if (!sheetReady()) return false;
  try {
    const res = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(signEnvelope(body)),
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
 * Each try is signed again (new timestamp and nonce), so retries are never mistaken for replays.
 */
export async function toSheetRetry(body: Record<string, unknown>, tries = 4): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    if (await toSheet(body)) return true;
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 600 * 2 ** i + Math.random() * 900));
  }
  return false;
}
