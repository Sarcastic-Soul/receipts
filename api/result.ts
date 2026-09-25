import { json } from "../lib/http.js";
import { getStore } from "../lib/store.js";
import type { CheckResult } from "../lib/types.js";

// GET /api/result?id=<id>  ->  a saved CheckResult (the data behind /r/<id>)

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9]{6,16}$/.test(id)) return json({ error: "Bad result id." }, 400);
  const result = await getStore().get<CheckResult>(`r:${id}`);
  if (!result) return json({ error: "Result not found. It may have expired." }, 404);
  // Saved results never change, so the CDN can keep them.
  return json(result, 200, { "Cache-Control": "public, s-maxage=86400, max-age=300" });
}
