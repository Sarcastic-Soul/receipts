import { z } from "zod";
import type { CmcResult, CmcSession } from "./client.js";

// Only the fields we read are listed; everything else passes through untouched.

const num = z.number().nullish();

export const MapEntry = z.looseObject({
  id: z.number(),
  rank: num,
  name: z.string(),
  symbol: z.string(),
  slug: z.string(),
  is_active: num,
  platform: z.looseObject({ name: z.string(), token_address: z.string().nullish() }).nullish(),
});
export type MapEntry = z.infer<typeof MapEntry>;

const Tag = z.union([z.string(), z.looseObject({ slug: z.string(), name: z.string() })]);

export const UsdQuote = z.looseObject({
  price: num,
  volume_24h: num,
  volume_change_24h: num,
  percent_change_1h: num,
  percent_change_24h: num,
  percent_change_7d: num,
  percent_change_30d: num,
  percent_change_60d: num,
  percent_change_90d: num,
  market_cap: num,
  fully_diluted_market_cap: num,
  last_updated: z.string().nullish(),
});

export const Quote = z.looseObject({
  id: z.number(),
  name: z.string(),
  symbol: z.string(),
  slug: z.string(),
  cmc_rank: num,
  num_market_pairs: num,
  date_added: z.string().nullish(),
  tags: z.array(Tag).nullish(),
  max_supply: num,
  circulating_supply: num,
  total_supply: num,
  infinite_supply: z.boolean().nullish(),
  self_reported_circulating_supply: num,
  self_reported_market_cap: num,
  platform: z.looseObject({ name: z.string(), token_address: z.string().nullish() }).nullish(),
  quote: z.looseObject({ USD: UsdQuote }),
});
export type Quote = z.infer<typeof Quote>;

export const Info = z.looseObject({
  id: z.number(),
  name: z.string(),
  symbol: z.string(),
  slug: z.string(),
  logo: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  "tag-names": z.array(z.string()).nullish(),
  date_added: z.string().nullish(),
  notice: z.string().nullish(),
  category: z.string().nullish(),
  platform: z.looseObject({ name: z.string(), token_address: z.string().nullish() }).nullish(),
});
export type Info = z.infer<typeof Info>;

export const MarketPair = z.looseObject({
  exchange: z.looseObject({ id: z.number().nullish(), name: z.string(), slug: z.string() }),
  market_pair: z.string(),
  category: z.string().nullish(),
  quote: z.record(z.string(), z.looseObject({ volume_24h: num, price: num })).nullish(),
});
export type MarketPair = z.infer<typeof MarketPair>;

export const MarketPairs = z.looseObject({
  id: z.number(),
  num_market_pairs: num,
  market_pairs: z.array(MarketPair),
});
export type MarketPairs = z.infer<typeof MarketPairs>;

export const GlobalMetrics = z.looseObject({
  btc_dominance: num,
  quote: z.looseObject({
    USD: z.looseObject({
      total_market_cap: num,
      total_market_cap_yesterday_percentage_change: num,
    }),
  }),
});
export type GlobalMetrics = z.infer<typeof GlobalMetrics>;

const Trending = z.array(z.looseObject({ id: z.number(), symbol: z.string(), name: z.string() }));

const DAY = 60 * 60 * 24;

function parse<T>(res: CmcResult<unknown>, schema: z.ZodType<T>): CmcResult<T> {
  if (!res.ok) return res as CmcResult<T>;
  const parsed = schema.safeParse(res.data);
  if (!parsed.success) return { ...res, ok: false, data: null, errorMessage: "Unexpected response shape from CMC" };
  return { ...res, data: parsed.data };
}

/** Every active coin with this ticker. This is how we find ticker impostors. */
export async function mapBySymbol(cmc: CmcSession, symbol: string) {
  const res = await cmc.get("/v1/cryptocurrency/map", { symbol: symbol.toUpperCase() }, DAY);
  return parse(res, z.array(MapEntry));
}

export async function mapBySlug(cmc: CmcSession, slug: string) {
  const res = await cmc.get("/v1/cryptocurrency/map", { slug }, DAY);
  return parse(res, z.array(MapEntry));
}

export async function infoByIds(cmc: CmcSession, ids: number[]) {
  const res = await cmc.get(
    "/v2/cryptocurrency/info",
    { id: ids.join(","), aux: "logo,tags,platform,date_added,notice" },
    DAY,
  );
  return parse(res, z.record(z.string(), Info));
}

/** Contract address (EVM or Solana) to coin. */
export async function infoByAddress(cmc: CmcSession, address: string) {
  const res = await cmc.get(
    "/v2/cryptocurrency/info",
    { address, aux: "logo,tags,platform,date_added,notice" },
    DAY,
  );
  return parse(res, z.record(z.string(), Info));
}

export async function quotesByIds(cmc: CmcSession, ids: number[]) {
  const res = await cmc.get("/v2/cryptocurrency/quotes/latest", { id: ids.join(","), convert: "USD" }, 60);
  return parse(res, z.record(z.string(), Quote));
}

export async function marketPairs(cmc: CmcSession, id: number) {
  const res = await cmc.get(
    "/v2/cryptocurrency/market-pairs/latest",
    { id: String(id), limit: "100", convert: "USD" },
    60 * 30,
    (data) => {
      // Receipts only need the exchange list, not every field of 100 pairs.
      const d = data as { market_pairs?: Array<{ exchange?: { name?: string }; market_pair?: string; quote?: Record<string, { volume_24h?: number }> }> };
      return {
        ...(data as object),
        market_pairs: d.market_pairs?.map((p) => ({
          exchange: p.exchange?.name,
          market_pair: p.market_pair,
          volume_24h_usd: p.quote?.USD?.volume_24h,
        })),
      };
    },
  );
  return parse(res, MarketPairs);
}

export async function globalMetrics(cmc: CmcSession) {
  const res = await cmc.get("/v1/global-metrics/quotes/latest", { convert: "USD" }, 300, (data) => {
    const d = data as GlobalMetrics;
    return {
      btc_dominance: d.btc_dominance,
      quote: {
        USD: {
          total_market_cap: d.quote?.USD?.total_market_cap,
          total_market_cap_yesterday_percentage_change: d.quote?.USD?.total_market_cap_yesterday_percentage_change,
        },
      },
    };
  });
  return parse(res, GlobalMetrics);
}

export async function trendingLatest(cmc: CmcSession) {
  const res = await cmc.get("/v1/cryptocurrency/trending/latest", { limit: "50" }, 60 * 15, (data) =>
    (data as Array<{ id: number; name: string; symbol: string }>).map(({ id, name, symbol }) => ({ id, name, symbol })),
  );
  return parse(res, Trending);
}
