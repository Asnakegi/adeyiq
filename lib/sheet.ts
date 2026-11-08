/**
 * Where usage events and access requests are sent: the Apps Script web app of the
 * "AdeyIQ Cargo Data" Google Sheet (scripts/access-requests.gs).
 * Set ADEYIQ_SHEET_URL in Vercel, or paste the /exec URL below. Empty = nothing is sent.
 */
export const SHEET_URL = process.env.ADEYIQ_SHEET_URL || "";

export async function toSheet(body: Record<string, unknown>): Promise<boolean> {
  if (!SHEET_URL) return false;
  try {
    const res = await fetch(SHEET_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return !!(data && data.ok);
  } catch {
    return false;
  }
}

/** Visitor location from Vercel's network headers. The IP address itself is never stored. */
export function locationOf(h: Headers) {
  const dec = (v: string | null) => {
    if (!v) return "";
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    country: h.get("x-vercel-ip-country") || "",
    region: dec(h.get("x-vercel-ip-country-region")),
    city: dec(h.get("x-vercel-ip-city")),
  };
}

export const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);
