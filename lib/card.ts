import type { Info, MapEntry, MarketPairs, Quote } from "./cmc/endpoints.js";
import { daysSince, pct, usd } from "./format.js";
import type { CoinCard, Impostor, RedFlag } from "./types.js";
import { baseRateLine } from "./baseRates.js";

export interface CardInput {
  entry: Pick<MapEntry, "id" | "name" | "symbol" | "slug" | "rank">;
  matchedBy: CoinCard["matchedBy"];
  query: string;
  impostors: MapEntry[];
  mapReceiptId?: string;
  quote: Quote | null;
  quoteReceiptId?: string;
  info: Info | null;
  infoReceiptId?: string;
  pairs: MarketPairs | null;
  pairsReceiptId?: string;
  now?: number;
}

export function buildCard(c: CardInput): CoinCard {
  const q = c.quote;
  const usdq = q?.quote.USD;
  const tags = (c.info?.["tag-names"] ?? c.info?.tags ?? q?.tags?.map((t) => (typeof t === "string" ? t : t.name)) ?? []).slice(0, 8);
  const card: CoinCard = {
    id: c.entry.id,
    name: c.entry.name,
    symbol: c.entry.symbol,
    slug: c.entry.slug,
    logo: c.info?.logo ?? null,
    rank: q?.cmc_rank ?? c.entry.rank ?? null,
    price: usdq?.price ?? null,
    change: {
      "1h": usdq?.percent_change_1h ?? null,
      "24h": usdq?.percent_change_24h ?? null,
      "7d": usdq?.percent_change_7d ?? null,
      "30d": usdq?.percent_change_30d ?? null,
      "60d": usdq?.percent_change_60d ?? null,
      "90d": usdq?.percent_change_90d ?? null,
    },
    marketCap: usdq?.market_cap ?? null,
    selfReportedMarketCap: q?.self_reported_market_cap ?? null,
    fdv: usdq?.fully_diluted_market_cap ?? null,
    volume24h: usdq?.volume_24h ?? null,
    volumeChange24h: usdq?.volume_change_24h ?? null,
    circulatingSupply: q?.circulating_supply ?? null,
    maxSupply: q?.max_supply ?? null,
    dateAdded: q?.date_added ?? c.info?.date_added ?? null,
    numMarketPairs: q?.num_market_pairs ?? null,
    tags,
    platform: q?.platform?.name ?? c.info?.platform?.name ?? null,
    matchedBy: c.matchedBy,
    query: c.query,
    redFlags: [],
    impostors: c.impostors.map(toImpostor),
    baseRate: null,
    receiptIds: [c.mapReceiptId, c.infoReceiptId, c.quoteReceiptId, c.pairsReceiptId].filter((x): x is string => !!x),
  };
  card.redFlags = redFlags(card, c);
  card.baseRate = baseRateLine(card.rank);
  return card;
}

function toImpostor(e: MapEntry): Impostor {
  return { id: e.id, name: e.name, symbol: e.symbol, slug: e.slug, rank: e.rank ?? null };
}

/** Warning signs computed only from CMC numbers. Each one points at its receipt. */
export function redFlags(card: CoinCard, c: CardInput): RedFlag[] {
  const flags: RedFlag[] = [];
  const add = (id: string, severity: RedFlag["severity"], text: string, receiptId?: string) =>
    flags.push({ id, severity, text, receiptId });

  if (c.info?.notice) add("notice", "high", `CMC notice: ${c.info.notice.replace(/<[^>]+>/g, "").slice(0, 240)}`, c.infoReceiptId);

  if (card.impostors.length > 0) {
    const n = card.impostors.length;
    add(
      "impostors",
      n >= 3 ? "high" : "medium",
      `${n} other coin${n === 1 ? "" : "s"} on CMC use the ticker $${card.symbol}. Check you have the right one.`,
      c.mapReceiptId,
    );
  }

  const unverifiedCap = (card.marketCap === null || card.marketCap === 0) && card.price !== null;
  if (unverifiedCap) {
    add(
      "unverified-supply",
      "high",
      card.selfReportedMarketCap
        ? `CMC has not verified the circulating supply. The ${usd(card.selfReportedMarketCap)} market cap is self-reported by the project.`
        : "CMC has not verified the circulating supply, so there is no market cap.",
      c.quoteReceiptId,
    );
  }

  const cap = card.marketCap || card.selfReportedMarketCap;
  if (cap && card.volume24h && card.volume24h / cap > 1) {
    add(
      "volume-vs-cap",
      "high",
      `24h volume (${usd(card.volume24h)}) is ${(card.volume24h / cap).toFixed(1)}× the market cap. Volume this high for the size can mean wash trading.`,
      c.quoteReceiptId,
    );
  }

  const age = daysSince(card.dateAdded, c.now);
  if (age !== null && age < 30) add("new", "medium", `Added to CMC only ${age} day${age === 1 ? "" : "s"} ago.`, c.quoteReceiptId);

  if (card.numMarketPairs !== null && card.numMarketPairs <= 3) {
    add("few-pairs", "medium", `Trades on only ${card.numMarketPairs} market pair${card.numMarketPairs === 1 ? "" : "s"}.`, c.quoteReceiptId);
  }

  const share = topExchangeShare(c.pairs);
  if (share && share.share > 0.8 && (card.numMarketPairs ?? 0) > 1) {
    add("one-exchange", "medium", `${Math.round(share.share * 100)}% of 24h volume is on one exchange (${share.exchange}).`, c.pairsReceiptId);
  }

  const d90 = card.change["90d"];
  if (d90 !== null && d90 <= -70) add("drawdown", "medium", `Price is ${pct(d90, 0)} over 90 days.`, c.quoteReceiptId);

  if (card.rank === null) add("no-rank", "info", "No CMC rank (untracked or too small to rank).", c.quoteReceiptId);
  else if (card.rank > 1000) add("low-rank", "info", `Ranked #${card.rank} on CMC.`, c.quoteReceiptId);

  if (card.tags.some((t) => /meme/i.test(t))) add("meme", "info", "Tagged as a meme coin on CMC.", c.infoReceiptId);

  return flags;
}

export function topExchangeShare(pairs: MarketPairs | null): { exchange: string; share: number } | null {
  if (!pairs?.market_pairs.length) return null;
  const byExchange = new Map<string, number>();
  let total = 0;
  for (const p of pairs.market_pairs) {
    const v = p.quote?.USD?.volume_24h ?? 0;
    total += v;
    byExchange.set(p.exchange.name, (byExchange.get(p.exchange.name) ?? 0) + v);
  }
  if (total <= 0) return null;
  const [exchange, v] = [...byExchange.entries()].sort((a, b) => b[1] - a[1])[0];
  return { exchange, share: v / total };
}
