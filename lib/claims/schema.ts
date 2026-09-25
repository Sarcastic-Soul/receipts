import { z } from "zod";

// What the LLM must return. Flat on purpose: Gemini's structured output handles flat
// objects with nullable fields much better than tagged unions.

export const CLAIM_KINDS = [
  "price_change", // "up 300% this week"
  "price_level", // "trading under $0.01"
  "rank", // "top 100 coin"
  "market_cap", // "low cap gem", "only $5M market cap"
  "volume_spike", // "volume exploding"
  "listed_on_exchange", // "listed on Binance"
  "new_listing", // "just launched", "brand new"
  "fixed_supply", // "fixed supply", "capped supply"
  "trending", // "trending on CMC"
  "market_wide", // "whole market is pumping"
  "unverifiable", // team doxxed, audit, partnerships, whales buying
  "opinion", // "next 100x", "undervalued", price predictions
] as const;

export const PERIODS = ["1h", "24h", "7d", "30d", "60d", "90d"] as const;

export const Claim = z.object({
  quote: z.string().describe("The exact words from the post that make this claim"),
  kind: z.enum(CLAIM_KINDS),
  coin: z.string().nullable().describe("Ticker symbol of the coin the claim is about, uppercase, no $"),
  direction: z.enum(["up", "down"]).nullable(),
  percent: z.number().nullable().describe("Claimed percent move, e.g. 300 for 'up 300%'"),
  period: z.enum(PERIODS).nullable().describe("Closest period: today=24h, this week=7d, this month=30d"),
  rankLimit: z.number().nullable().describe("N in 'top N'"),
  usdValue: z.number().nullable().describe("Dollar amount in the claim, e.g. 5000000 for '$5M'"),
  comparator: z.enum(["above", "below", "about"]).nullable(),
  exchange: z.string().nullable().describe("Exchange name for listing claims"),
  reason: z.string().nullable().describe("For unverifiable/opinion: why market data can't check it"),
});
export type Claim = z.infer<typeof Claim>;

export const Mention = z.object({
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  address: z.string().nullable(),
});
export type Mention = z.infer<typeof Mention>;

export const Extraction = z.object({
  coins: z.array(Mention).max(8),
  claims: z.array(Claim).max(12),
});
export type Extraction = z.infer<typeof Extraction>;

/** Fill in any missing optional fields so partial objects still parse. */
export function claimDefaults(partial: Partial<Claim> & Pick<Claim, "quote" | "kind">): Claim {
  return {
    coin: null,
    direction: null,
    percent: null,
    period: null,
    rankLimit: null,
    usdValue: null,
    comparator: null,
    exchange: null,
    reason: null,
    ...partial,
  };
}
