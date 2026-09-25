import type { CmcResult } from "../cmc/client.js";
import type { GlobalMetrics, MarketPairs } from "../cmc/endpoints.js";
import { daysSince, pct, usd } from "../format.js";
import type { ClaimResult, CoinCard, Evidence, Verdict } from "../types.js";
import type { Claim } from "./schema.js";

// Deterministic claim checkers. The LLM only says *what* was claimed; every verdict
// and number here comes from CMC data through plain code.

/** Default meaning of "low cap" when the post gives no number. */
export const LOW_CAP_USD = 100_000_000;
/** "Volume exploding" is true when 24h volume grew at least this much. */
export const VOLUME_SPIKE_PCT = 50;
/** Whole-market moves smaller than this (in a day) count as flat. */
export const MARKET_MOVE_PCT = 1;

export interface CoinData {
  card: CoinCard;
  quoteReceiptId?: string;
  pairs?: CmcResult<MarketPairs>;
}

export interface CheckContext {
  /** Keyed by uppercase symbol. */
  coins: Map<string, CoinData>;
  /** Coin to use when a claim names none (the first one found). */
  primary: CoinData | null;
  global?: CmcResult<GlobalMetrics>;
  trending?: CmcResult<Array<{ id: number; symbol: string; name: string }>>;
  unresolved: string[];
  now?: number;
}

type Outcome = Pick<ClaimResult, "verdict" | "summary" | "evidence">;

export function checkClaim(claim: Claim, ctx: CheckContext, id: string): ClaimResult {
  const base = { id, quote: claim.quote, kind: claim.kind, coin: claim.coin?.toUpperCase().replace(/^\$/, "") ?? null };
  return { ...base, ...runChecker(claim, ctx) };
}

function runChecker(claim: Claim, ctx: CheckContext): Outcome {
  if (claim.kind === "opinion") {
    return { verdict: "unverifiable", summary: "Opinion or prediction, not a fact. Market data can't check the future.", evidence: [] };
  }
  if (claim.kind === "unverifiable") {
    return {
      verdict: "unverifiable",
      summary: claim.reason ?? "Market data can't prove or disprove this.",
      evidence: [],
    };
  }
  if (claim.kind === "market_wide") return checkMarketWide(claim, ctx);

  const coin = findCoin(claim, ctx);
  if (!coin) {
    const sym = claim.coin?.toUpperCase();
    return {
      verdict: "unverifiable",
      summary: sym && ctx.unresolved.includes(sym)
        ? `$${sym} was not found on CoinMarketCap, so there is no market data to check.`
        : "The post doesn't say which coin this is about.",
      evidence: [],
    };
  }

  switch (claim.kind) {
    case "price_change":
      return checkPriceChange(claim, coin);
    case "price_level":
      return checkPriceLevel(claim, coin);
    case "rank":
      return checkRank(claim, coin);
    case "market_cap":
      return checkMarketCap(claim, coin);
    case "volume_spike":
      return checkVolume(coin);
    case "listed_on_exchange":
      return checkExchange(claim, coin);
    case "new_listing":
      return checkNewListing(coin, ctx.now);
    case "fixed_supply":
      return checkSupply(coin);
    case "trending":
      return checkTrending(coin, ctx);
  }
  return { verdict: "unverifiable", summary: "No checker for this kind of claim.", evidence: [] };
}

function findCoin(claim: Claim, ctx: CheckContext): CoinData | null {
  const sym = claim.coin?.toUpperCase().replace(/^\$/, "");
  if (sym) {
    const direct = ctx.coins.get(sym);
    if (direct) return direct;
    for (const c of ctx.coins.values()) if (c.card.name.toUpperCase() === sym) return c;
    return null;
  }
  return ctx.primary;
}

function ev(label: string, value: string, receiptId?: string): Evidence {
  return { label, value, receiptId };
}

export function checkPriceChange(claim: Claim, coin: CoinData): Outcome {
  const { card } = coin;
  const period = claim.period ?? "24h";
  const actual = card.change[period];
  const evidence = [ev(`${period} price change`, pct(actual), coin.quoteReceiptId)];
  if (actual === null) return { verdict: "unverifiable", summary: `CMC has no ${period} change for $${card.symbol}.`, evidence };
  if (!claim.period) evidence.push(ev("7d price change", pct(card.change["7d"]), coin.quoteReceiptId));

  const wantUp = claim.direction !== "down";
  const signOk = wantUp ? actual > 0 : actual < 0;
  const moved = `$${card.symbol} is ${pct(actual)} over ${period}`;
  if (!signOk) {
    return { verdict: "false", summary: `${moved}. It went ${actual > 0 ? "up" : "down"}, not ${wantUp ? "up" : "down"}.`, evidence };
  }
  if (claim.percent === null) return { verdict: "true", summary: `${moved}.`, evidence };

  const claimed = Math.abs(claim.percent);
  const ratio = Math.abs(actual) / claimed;
  if (ratio >= 0.8) return { verdict: "true", summary: `${moved}, close to or above the claimed ${claimed}%.`, evidence };
  if (ratio >= 0.4) return { verdict: "misleading", summary: `${moved}, well short of the claimed ${claimed}%.`, evidence };
  return { verdict: "false", summary: `${moved}, nowhere near the claimed ${claimed}%.`, evidence };
}

export function checkPriceLevel(claim: Claim, coin: CoinData): Outcome {
  const { card } = coin;
  const evidence = [ev("Price", usd(card.price), coin.quoteReceiptId)];
  if (card.price === null || claim.usdValue === null) {
    return { verdict: "unverifiable", summary: "No price or target to compare.", evidence };
  }
  const p = card.price;
  const v = claim.usdValue;
  let ok: boolean;
  if (claim.comparator === "above") ok = p > v;
  else if (claim.comparator === "below") ok = p < v;
  else ok = Math.abs(p - v) / v <= 0.1;
  const rel = claim.comparator === "above" ? "above" : claim.comparator === "below" ? "below" : "about";
  return {
    verdict: ok ? "true" : "false",
    summary: `$${card.symbol} trades at ${usd(p)}, ${ok ? "" : "not "}${rel} ${usd(v)}.`,
    evidence,
  };
}

export function checkRank(claim: Claim, coin: CoinData): Outcome {
  const { card } = coin;
  const evidence = [ev("CMC rank", card.rank === null ? "unranked" : `#${card.rank}`, coin.quoteReceiptId)];
  const limit = claim.rankLimit;
  if (limit === null) return { verdict: "unverifiable", summary: "The claim gives no rank to check.", evidence };
  if (card.rank === null) return { verdict: "false", summary: `$${card.symbol} has no CMC rank, so it is not top ${limit}.`, evidence };
  const ok = card.rank <= limit;
  return {
    verdict: ok ? "true" : "false",
    summary: `$${card.symbol} is ranked #${card.rank} on CMC, ${ok ? "inside" : "outside"} the top ${limit}.`,
    evidence,
  };
}

export function checkMarketCap(claim: Claim, coin: CoinData): Outcome {
  const { card } = coin;
  const threshold = claim.usdValue ?? LOW_CAP_USD;
  const cap = card.marketCap || null;
  const evidence = [
    ev("Market cap", usd(cap), coin.quoteReceiptId),
    ev("Fully diluted value", usd(card.fdv), coin.quoteReceiptId),
  ];
  if (cap === null) {
    const self = card.selfReportedMarketCap;
    return {
      verdict: "misleading",
      summary: self
        ? `CMC hasn't verified $${card.symbol}'s supply. Its ${usd(self)} market cap is only self-reported by the project.`
        : `CMC hasn't verified $${card.symbol}'s supply, so its market cap is unknown.`,
      evidence,
    };
  }
  const comparator = claim.comparator ?? "below";
  const defNote = claim.usdValue === null ? ` ("low cap" read as under ${usd(LOW_CAP_USD)})` : "";
  if (comparator === "about") {
    const ok = Math.abs(cap - threshold) / threshold <= 0.25;
    return { verdict: ok ? "true" : "false", summary: `Market cap is ${usd(cap)}, ${ok ? "" : "not "}about ${usd(threshold)}.`, evidence };
  }
  const ok = comparator === "below" ? cap < threshold : cap > threshold;
  // Small cap but a huge fully diluted value means lots of supply still to unlock.
  if (ok && comparator === "below" && card.fdv && card.fdv > threshold * 3 && card.fdv > cap * 3) {
    return {
      verdict: "misleading",
      summary: `Market cap is ${usd(cap)}${defNote}, but the fully diluted value is ${usd(card.fdv)}: most of the supply isn't circulating yet.`,
      evidence,
    };
  }
  return {
    verdict: ok ? "true" : "false",
    summary: `Market cap is ${usd(cap)}, ${ok ? "" : "not "}${comparator} ${usd(threshold)}${defNote}. Rank #${card.rank ?? "n/a"}.`,
    evidence,
  };
}

export function checkVolume(coin: CoinData): Outcome {
  const { card } = coin;
  const change = card.volumeChange24h;
  const evidence = [
    ev("24h volume", usd(card.volume24h), coin.quoteReceiptId),
    ev("Volume change vs previous 24h", pct(change), coin.quoteReceiptId),
  ];
  if (change === null) return { verdict: "unverifiable", summary: "CMC has no volume change for this coin.", evidence };
  let verdict: Verdict = "false";
  if (change >= VOLUME_SPIKE_PCT) verdict = "true";
  else if (change > 0) verdict = "misleading";
  const summary =
    verdict === "true"
      ? `24h volume is ${pct(change, 0)} vs the day before.`
      : verdict === "misleading"
        ? `Volume is up only ${pct(change, 0)} in 24h. That's not "exploding".`
        : `Volume is down ${Math.abs(change).toFixed(0)}% in 24h.`;
  return { verdict, summary, evidence };
}

export function checkExchange(claim: Claim, coin: CoinData): Outcome {
  const { card } = coin;
  const want = (claim.exchange ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const res = coin.pairs;
  if (!want) return { verdict: "unverifiable", summary: "No exchange named.", evidence: [] };
  if (!res || !res.ok || !res.data) {
    return {
      verdict: res?.needsPlan ? "needs_plan" : "unverifiable",
      summary: res?.needsPlan
        ? "Exchange listings need CMC's market-pairs endpoint, which our current API plan doesn't include."
        : `Couldn't load market pairs for $${card.symbol}${res?.errorMessage ? ` (${res.errorMessage})` : ""}.`,
      evidence: res ? [ev("Request", "market-pairs/latest failed", res.receiptId)] : [],
    };
  }
  const pairs = res.data.market_pairs;
  const matches = pairs.filter((p) => {
    const name = p.exchange.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const slug = p.exchange.slug.toLowerCase().replace(/[^a-z0-9]/g, "");
    return name.startsWith(want) || slug.startsWith(want);
  });
  const total = pairs.reduce((s, p) => s + (p.quote?.USD?.volume_24h ?? 0), 0);
  const vol = matches.reduce((s, p) => s + (p.quote?.USD?.volume_24h ?? 0), 0);
  const evidence = [ev("Pairs checked", `${pairs.length} of ${res.data.num_market_pairs ?? pairs.length}`, res.receiptId)];
  if (matches.length) {
    const exName = matches[0].exchange.name;
    evidence.push(ev(`${exName} pairs`, matches.slice(0, 4).map((m) => m.market_pair).join(", "), res.receiptId));
    const share = total > 0 ? ` (${Math.round((vol / total) * 100)}% of 24h volume)` : "";
    return { verdict: "true", summary: `$${card.symbol} trades on ${exName}: ${matches.length} pair${matches.length === 1 ? "" : "s"}${share}.`, evidence };
  }
  const covered = pairs.length >= (res.data.num_market_pairs ?? pairs.length);
  return {
    verdict: covered ? "false" : "misleading",
    summary: covered
      ? `No ${claim.exchange} pairs among all ${pairs.length} market pairs CMC lists for $${card.symbol}.`
      : `No ${claim.exchange} pairs in the top ${pairs.length} pairs by volume on CMC, so any listing there is tiny.`,
    evidence,
  };
}

export function checkNewListing(coin: CoinData, now?: number): Outcome {
  const { card } = coin;
  const age = daysSince(card.dateAdded, now);
  const evidence = [ev("Added to CMC", card.dateAdded?.slice(0, 10) ?? "n/a", coin.quoteReceiptId)];
  if (age === null) return { verdict: "unverifiable", summary: "CMC has no listing date.", evidence };
  const ok = age <= 30;
  return {
    verdict: ok ? "true" : "false",
    summary: ok ? `Added to CMC ${age} days ago.` : `Not new: added to CMC ${age} days ago.`,
    evidence,
  };
}

export function checkSupply(coin: CoinData): Outcome {
  const { card } = coin;
  const evidence = [
    ev("Max supply", card.maxSupply === null ? "none" : card.maxSupply.toLocaleString("en-US"), coin.quoteReceiptId),
    ev("Circulating supply", card.circulatingSupply?.toLocaleString("en-US") ?? "n/a", coin.quoteReceiptId),
  ];
  if (card.maxSupply) {
    return { verdict: "true", summary: `CMC lists a max supply of ${card.maxSupply.toLocaleString("en-US")} $${card.symbol}.`, evidence };
  }
  return { verdict: "false", summary: `CMC lists no max supply for $${card.symbol}.`, evidence };
}

export function checkTrending(coin: CoinData, ctx: CheckContext): Outcome {
  const res = ctx.trending;
  if (!res || !res.ok || !res.data) {
    return {
      verdict: res?.needsPlan ? "needs_plan" : "unverifiable",
      summary: res?.needsPlan
        ? "CMC's trending endpoint isn't on our current API plan."
        : "Couldn't load CMC trending data.",
      evidence: res ? [ev("Request", "trending/latest failed", res.receiptId)] : [],
    };
  }
  const idx = res.data.findIndex((t) => t.id === coin.card.id);
  const evidence = [ev("CMC trending list", idx >= 0 ? `#${idx + 1} of ${res.data.length}` : `not in top ${res.data.length}`, res.receiptId)];
  return idx >= 0
    ? { verdict: "true", summary: `$${coin.card.symbol} is #${idx + 1} on CMC's trending list.`, evidence }
    : { verdict: "false", summary: `$${coin.card.symbol} is not on CMC's trending list.`, evidence };
}

export function checkMarketWide(claim: Claim, ctx: CheckContext): Outcome {
  const res = ctx.global;
  const change = res?.data?.quote.USD.total_market_cap_yesterday_percentage_change ?? null;
  if (!res?.ok || change === null) return { verdict: "unverifiable", summary: "Couldn't load global market data.", evidence: [] };
  const evidence = [
    ev("Total crypto market cap", usd(res.data?.quote.USD.total_market_cap), res.receiptId),
    ev("Change vs yesterday", pct(change), res.receiptId),
  ];
  if (!claim.direction) return { verdict: "unverifiable", summary: `Total market cap is ${pct(change)} vs yesterday.`, evidence };
  const ok = claim.direction === "up" ? change > 0 : change < 0;
  if (ok && Math.abs(change) < MARKET_MOVE_PCT) {
    return {
      verdict: "misleading",
      summary: `The whole crypto market is only ${pct(change)} vs yesterday. That's flat, not a big move.`,
      evidence,
    };
  }
  return {
    verdict: ok ? "true" : "false",
    summary: `The whole crypto market is ${pct(change)} vs yesterday.`,
    evidence,
  };
}
