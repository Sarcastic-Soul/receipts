import { beforeEach, describe, expect, it } from "vitest";
import { runCheck } from "../lib/check";
import { fallbackExtract } from "../lib/claims/fallback";
import { CmcSession } from "../lib/cmc/client";
import { MemoryStore, setStore } from "../lib/store";
import { fakeCmcFetch, NOW } from "./fixtures";

beforeEach(() => setStore(new MemoryStore()));

const extract = async (text: string) => ({ extraction: fallbackExtract(text), extractor: "fallback" as const });

describe("runCheck end to end (fake CMC)", () => {
  it("checks a shill post and records receipts", async () => {
    const { fetch } = fakeCmcFetch();
    const r = await runCheck("$PEPE is up 300% this week and still a low cap gem. Volume exploding, listed on Binance. Next 100x!", {
      cmc: new CmcSession("test-key", fetch),
      extract,
      now: NOW,
    });
    expect(r.coins.map((c) => c.symbol)).toEqual(["PEPE"]);
    expect(r.coins[0].impostors).toHaveLength(2);
    const byKind = Object.fromEntries(r.claims.map((c) => [c.kind, c.verdict]));
    expect(byKind).toMatchObject({
      price_change: "false",
      market_cap: "false",
      volume_spike: "misleading",
      listed_on_exchange: "true",
      opinion: "unverifiable",
    });
    // Every piece of evidence points at a receipt that exists.
    const ids = new Set(r.receipts.map((x) => x.id));
    for (const c of r.claims) for (const e of c.evidence) if (e.receiptId) expect(ids.has(e.receiptId)).toBe(true);
    expect(r.receipts.map((x) => x.endpoint)).toEqual(
      expect.arrayContaining(["/v1/cryptocurrency/map", "/v2/cryptocurrency/quotes/latest", "/v2/cryptocurrency/info", "/v2/cryptocurrency/market-pairs/latest"]),
    );
  });

  it("uses the cache on the second run", async () => {
    const first = fakeCmcFetch();
    await runCheck("$PEPE", { cmc: new CmcSession("k", first.fetch), now: NOW });
    const second = fakeCmcFetch();
    const r = await runCheck("$PEPE", { cmc: new CmcSession("k", second.fetch), now: NOW });
    expect(second.calls).toEqual([]);
    expect(r.receipts.every((x) => x.cache === "hit")).toBe(true);
  });

  it("resolves a contract address", async () => {
    const { fetch } = fakeCmcFetch();
    const r = await runCheck("0x6982508145454ce325ddbe47a25d4ec3d2311933", { cmc: new CmcSession("k", fetch), now: NOW });
    expect(r.input.kind).toBe("address");
    expect(r.coins[0]).toMatchObject({ symbol: "PEPE", matchedBy: "address" });
  });

  it("reports coins that aren't on CMC", async () => {
    const { fetch } = fakeCmcFetch();
    const r = await runCheck("$PEPE and $NOTACOIN up 50% today", { cmc: new CmcSession("k", fetch), extract, now: NOW });
    expect(r.unresolved).toContain("NOTACOIN");
  });

  it("marks exchange claims as needs_plan when market pairs are blocked", async () => {
    const { fetch } = fakeCmcFetch({ pairsForbidden: true });
    const r = await runCheck("$PEPE listed on Binance", { cmc: new CmcSession("k", fetch), extract, now: NOW });
    expect(r.claims.find((c) => c.kind === "listed_on_exchange")?.verdict).toBe("needs_plan");
    expect(r.notes.join(" ")).toContain("Market pairs");
  });

  it("gets tweet text through the tweet fetcher", async () => {
    const { fetch } = fakeCmcFetch();
    const r = await runCheck("https://x.com/shill/status/123456789", {
      cmc: new CmcSession("k", fetch),
      extract,
      getTweet: async (url) => ({ url, author: "Shill", authorUrl: "https://x.com/shill", text: "$PEPE top 10 coin" }),
      now: NOW,
    });
    expect(r.input.tweet?.author).toBe("Shill");
    expect(r.claims[0]).toMatchObject({ kind: "rank", verdict: "false" });
  });
});

describe("runCheck when CMC is down", () => {
  it("says CMC failed instead of 'not found'", async () => {
    const down = (async () => new Response(JSON.stringify({ status: { error_code: 1008, error_message: "rate limit" } }), { status: 429 })) as unknown as typeof fetch;
    await expect(runCheck("$PEPE", { cmc: new CmcSession("k", down), now: NOW })).rejects.toThrow(/didn't answer/);
  });
});
