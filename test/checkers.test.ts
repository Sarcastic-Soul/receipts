import { describe, expect, it } from "vitest";
import { buildCard } from "../lib/card";
import { checkClaim, type CheckContext, type CoinData } from "../lib/claims/checkers";
import { claimDefaults, type Claim } from "../lib/claims/schema";
import type { Quote } from "../lib/cmc/endpoints";
import { NOW, pairsPepe, quoteFake, quotePepe } from "./fixtures";

function coin(q: typeof quotePepe | typeof quoteFake, pairs: CoinData["pairs"] = undefined): CoinData {
  const card = buildCard({
    entry: { id: q.id, name: q.name, symbol: q.symbol, slug: q.slug, rank: q.cmc_rank },
    matchedBy: "symbol",
    query: q.symbol,
    impostors: [],
    quote: q as unknown as Quote,
    quoteReceiptId: "r1",
    info: null,
    pairs: pairs?.data ?? null,
    now: NOW,
  });
  return { card, quoteReceiptId: "r1", pairs };
}

function ctx(...coins: CoinData[]): CheckContext {
  return { coins: new Map(coins.map((c) => [c.card.symbol, c])), primary: coins[0] ?? null, unresolved: ["NOPE"], now: NOW };
}

const check = (partial: Partial<Claim> & Pick<Claim, "quote" | "kind">, c: CheckContext) =>
  checkClaim(claimDefaults(partial), c, "c1");

describe("price_change", () => {
  const c = ctx(coin(quotePepe));
  it("false when the real move is far smaller", () => {
    expect(check({ quote: "up 300% this week", kind: "price_change", coin: "PEPE", direction: "up", percent: 300, period: "7d" }, c).verdict).toBe("false");
  });
  it("misleading when the move is roughly half", () => {
    expect(check({ quote: "up 80% this week", kind: "price_change", coin: "PEPE", direction: "up", percent: 80, period: "7d" }, c).verdict).toBe("misleading");
  });
  it("true when close", () => {
    const r = check({ quote: "up 40% this week", kind: "price_change", coin: "PEPE", direction: "up", percent: 40, period: "7d" }, c);
    expect(r.verdict).toBe("true");
    expect(r.evidence[0]).toMatchObject({ value: "+42.0%", receiptId: "r1" });
  });
  it("false when the direction is wrong", () => {
    expect(check({ quote: "pumping over 90 days", kind: "price_change", coin: "PEPE", direction: "up", period: "90d" }, c).verdict).toBe("false");
  });
});

describe("rank and market cap", () => {
  const c = ctx(coin(quotePepe), coin(quoteFake));
  it("checks top N", () => {
    expect(check({ quote: "top 50", kind: "rank", coin: "PEPE", rankLimit: 50 }, c).verdict).toBe("true");
    expect(check({ quote: "top 10", kind: "rank", coin: "PEPE", rankLimit: 10 }, c).verdict).toBe("false");
  });
  it("low cap is false for a $4B coin", () => {
    const r = check({ quote: "low cap gem", kind: "market_cap", coin: "PEPE", comparator: "below" }, c);
    expect(r.verdict).toBe("false");
    expect(r.summary).toContain("$4.20B");
  });
  it("self-reported market cap is misleading", () => {
    expect(check({ quote: "low cap", kind: "market_cap", coin: "PEPEC", comparator: "below" }, c).verdict).toBe("misleading");
  });
});

describe("volume, supply, listing age", () => {
  const c = ctx(coin(quotePepe), coin(quoteFake));
  it("volume up 12% is not exploding", () => {
    expect(check({ quote: "volume exploding", kind: "volume_spike", coin: "PEPE" }, c).verdict).toBe("misleading");
  });
  it("volume up 400% is a spike", () => {
    expect(check({ quote: "volume exploding", kind: "volume_spike", coin: "PEPEC" }, c).verdict).toBe("true");
  });
  it("fixed supply", () => {
    expect(check({ quote: "fixed supply", kind: "fixed_supply", coin: "PEPE" }, c).verdict).toBe("true");
    expect(check({ quote: "fixed supply", kind: "fixed_supply", coin: "PEPEC" }, c).verdict).toBe("false");
  });
  it("new listing", () => {
    expect(check({ quote: "just launched", kind: "new_listing", coin: "PEPEC" }, c).verdict).toBe("true");
    expect(check({ quote: "just launched", kind: "new_listing", coin: "PEPE" }, c).verdict).toBe("false");
  });
});

describe("listed_on_exchange", () => {
  const pairs = { ok: true, data: pairsPepe, receiptId: "r9", needsPlan: false, status: 200 } as CoinData["pairs"];
  it("finds Binance pairs", () => {
    const r = check({ quote: "listed on Binance", kind: "listed_on_exchange", coin: "PEPE", exchange: "Binance" }, ctx(coin(quotePepe, pairs)));
    expect(r.verdict).toBe("true");
    expect(r.summary).toContain("50% of 24h volume");
  });
  it("false when no pair on that exchange", () => {
    const r = check({ quote: "listed on Coinbase", kind: "listed_on_exchange", coin: "PEPE", exchange: "Coinbase" }, ctx(coin(quotePepe, pairs)));
    expect(r.verdict).toBe("false");
  });
  it("needs_plan when market pairs are blocked", () => {
    const blocked = { ok: false, data: null, receiptId: "r9", needsPlan: true, status: 403 } as CoinData["pairs"];
    expect(check({ quote: "on Binance", kind: "listed_on_exchange", coin: "PEPE", exchange: "Binance" }, ctx(coin(quotePepe, blocked))).verdict).toBe("needs_plan");
  });
});

describe("claims that market data can't check", () => {
  const c = ctx(coin(quotePepe));
  it("opinions and team claims are unverifiable", () => {
    expect(check({ quote: "next 100x", kind: "opinion" }, c).verdict).toBe("unverifiable");
    expect(check({ quote: "team doxxed", kind: "unverifiable", reason: "not market data" }, c).verdict).toBe("unverifiable");
  });
  it("coins not on CMC are unverifiable with a clear reason", () => {
    const r = check({ quote: "$NOPE up 50%", kind: "price_change", coin: "NOPE", direction: "up", percent: 50 }, c);
    expect(r.verdict).toBe("unverifiable");
    expect(r.summary).toContain("not found on CoinMarketCap");
  });
});

describe("red flags", () => {
  it("flags a new, unverified, one-pair coin", () => {
    const ids = coin(quoteFake).card.redFlags.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["unverified-supply", "volume-vs-cap", "new", "few-pairs", "no-rank"]));
  });
  it("flags nothing serious for a big coin", () => {
    expect(coin(quotePepe).card.redFlags.filter((f) => f.severity === "high")).toEqual([]);
  });
});

describe("market_wide", () => {
  const global = (change: number) =>
    ({ ok: true, receiptId: "r7", needsPlan: false, status: 200, data: { btc_dominance: 57, quote: { USD: { total_market_cap: 3.9e12, total_market_cap_yesterday_percentage_change: change } } } }) as CheckContext["global"];
  const claim = { quote: "whole market is pumping", kind: "market_wide" as const, direction: "up" as const };
  it("a flat day is misleading, not true", () => {
    expect(check(claim, { ...ctx(), global: global(0.04) }).verdict).toBe("misleading");
  });
  it("a real move is true", () => {
    expect(check(claim, { ...ctx(), global: global(3.2) }).verdict).toBe("true");
  });
  it("wrong direction is false", () => {
    expect(check(claim, { ...ctx(), global: global(-2) }).verdict).toBe("false");
  });
});
