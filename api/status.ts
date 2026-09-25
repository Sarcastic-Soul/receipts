import { json } from "../lib/http.js";
import { isPersistent } from "../lib/store.js";

// GET /api/status  ->  which CMC plan the key is on and what's configured.
// /v1/key/info costs no credits.

export async function GET() {
  const key = process.env.CMC_API_KEY;
  let plan: unknown = null;
  if (key) {
    const res = await fetch("https://pro-api.coinmarketcap.com/v1/key/info", {
      headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" },
    }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { data?: { plan?: unknown; usage?: unknown } } | null;
    plan = body?.data ? { plan: body.data.plan, usage: body.data.usage } : { error: `HTTP ${res?.status ?? "network error"}` };
  }
  return json(
    { cmcKey: !!key, llmKey: !!process.env.GEMINI_API_KEY, persistentStore: isPersistent(), cmc: plan },
    200,
    { "Cache-Control": "public, s-maxage=600" },
  );
}
