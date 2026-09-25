import { json } from "../lib/http.js";
import { getStore } from "../lib/store.js";

// Called once a day by Vercel Cron (see vercel.json) so the Upstash free-tier
// database never sits idle long enough to be archived.

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const now = new Date().toISOString();
  await getStore().set("keepalive:last", now);
  return json({ ok: true, at: now });
}
