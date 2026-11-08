import { clip, locationOf, SHEET_URL, toSheet } from "@/lib/sheet";

/* Access requests from the home page form → "Access requests" tab of the Google Sheet (and an email to the owner). */
export async function POST(request: Request) {
  if (!SHEET_URL) return Response.json({ ok: false, error: "not set up" }, { status: 503 });
  let d: Record<string, unknown>;
  try {
    d = JSON.parse((await request.text()).slice(0, 8000));
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (d.website) return Response.json({ ok: true }); // hidden field filled in: a bot
  const email = clip(d.email, 200);
  if (!clip(d.name, 200).trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))
    return Response.json({ ok: false, error: "name and email are required" }, { status: 400 });
  const loc = locationOf(request.headers);
  const ok = await toSheet({
    type: "request",
    name: clip(d.name, 200),
    email,
    company: clip(d.company, 200),
    phone: clip(d.phone, 60),
    modules: (Array.isArray(d.modules) ? d.modules : []).map((m) => clip(m, 60)),
    message: clip(d.message, 2000),
    page: [loc.city, loc.country].filter(Boolean).join(", ") || clip(d.page, 200),
  });
  return Response.json({ ok }, { status: ok ? 200 : 502 });
}
