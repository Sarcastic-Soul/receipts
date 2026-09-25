import { createHash } from "node:crypto";
import { runCheck, UserError } from "../lib/check.js";
import { clientIp, json } from "../lib/http.js";
import { getStore } from "../lib/store.js";
import type { CheckResult } from "../lib/types.js";

// POST /api/check  { input: string }  ->  CheckResult (also saved for /r/<id>)

const MAX_INPUT = 2000;
const RATE_LIMIT_PER_MIN = 12;
// Same input within this window returns the same saved result (saves CMC credits).
const SAME_INPUT_SECONDS = 120;
// Shared result pages stay up for a year.
const RESULT_TTL = 60 * 60 * 24 * 365;

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { input?: unknown } | null;
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  if (!input) return json({ error: "Paste a post link, post text, a $TICKER or a contract address." }, 400);
  if (input.length > MAX_INPUT) return json({ error: `Input is too long (max ${MAX_INPUT} characters).` }, 400);

  const store = getStore();
  try {
    const hits = await store.incr(`rl:${clientIp(req)}:${Math.floor(Date.now() / 60000)}`, 60);
    if (hits > RATE_LIMIT_PER_MIN) return json({ error: "Too many checks. Wait a minute and try again." }, 429);
  } catch {
    // rate limiter down: allow the request
  }

  const inputKey = `in:${createHash("sha256").update(input).digest("hex").slice(0, 32)}`;
  const recentId = await store.get<string>(inputKey).catch(() => null);
  if (recentId) {
    const recent = await store.get<CheckResult>(`r:${recentId}`).catch(() => null);
    if (recent) return json(recent);
  }

  try {
    const result = await runCheck(input);
    await store.set(`r:${result.id}`, result, RESULT_TTL).catch(() => {});
    await store.set(inputKey, result.id, SAME_INPUT_SECONDS).catch(() => {});
    return json(result);
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 422);
    console.error("check failed", err);
    return json({ error: "Something went wrong while checking. Try again." }, 500);
  }
}
