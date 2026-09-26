// Fake CMC responses in the real response shape, for tests.

const now = Date.parse("2026-09-26T00:00:00Z");
export const NOW = now;

export const quotePepe = {
  id: 24478,
  name: "Pepe",
  symbol: "PEPE",
  slug: "pepe",
  cmc_rank: 30,
  num_market_pairs: 500,
  date_added: "2023-04-17T00:00:00.000Z",
  tags: [{ slug: "memes", name: "Memes", category: "INDUSTRY" }],
  max_supply: 420690000000000,
  circulating_supply: 420690000000000,
  total_supply: 420690000000000,
  infinite_supply: false,
  self_reported_circulating_supply: null,
  self_reported_market_cap: null,
  platform: { id: 1027, name: "Ethereum", symbol: "ETH", slug: "ethereum", token_address: "0x6982508145454ce325ddbe47a25d4ec3d2311933" },
  quote: {
    USD: {
      price: 0.00001,
      volume_24h: 600_000_000,
      volume_change_24h: 12.5,
      percent_change_1h: 0.2,
      percent_change_24h: 3.1,
      percent_change_7d: 42,
      percent_change_30d: 10,
      percent_change_60d: 5,
      percent_change_90d: -20,
      market_cap: 4_200_000_000,
      fully_diluted_market_cap: 4_200_000_000,
      last_updated: "2026-09-26T00:00:00.000Z",
    },
  },
};

export const quoteFake = {
  id: 99999,
  name: "Pepe Classic",
  symbol: "PEPEC",
  slug: "pepe-classic",
  cmc_rank: null,
  num_market_pairs: 1,
  date_added: "2026-09-20T00:00:00.000Z",
  tags: [],
  max_supply: null,
  circulating_supply: 0,
  total_supply: 1e12,
  infinite_supply: false,
  self_reported_circulating_supply: 1e12,
  self_reported_market_cap: 2_000_000,
  platform: null,
  quote: {
    USD: {
      price: 0.000002,
      volume_24h: 5_000_000,
      volume_change_24h: 400,
      percent_change_1h: 1,
      percent_change_24h: 80,
      percent_change_7d: 310,
      percent_change_30d: null,
      percent_change_60d: null,
      percent_change_90d: null,
      market_cap: 0,
      fully_diluted_market_cap: 2_000_000,
      last_updated: "2026-09-26T00:00:00.000Z",
    },
  },
};

export const mapPepe = [
  { id: 24478, rank: 30, name: "Pepe", symbol: "PEPE", slug: "pepe", is_active: 1, platform: null },
  { id: 30001, rank: 2400, name: "Pepe 2.0", symbol: "PEPE", slug: "pepe-2", is_active: 1, platform: null },
  { id: 30002, rank: null, name: "PepeFork", symbol: "PEPE", slug: "pepefork", is_active: 1, platform: null },
];

export const infoPepe = {
  id: 24478,
  name: "Pepe",
  symbol: "PEPE",
  slug: "pepe",
  logo: "https://s2.coinmarketcap.com/static/img/coins/64x64/24478.png",
  tags: ["memes"],
  "tag-names": ["Memes"],
  date_added: "2023-04-17T00:00:00.000Z",
  notice: "",
  platform: { name: "Ethereum", token_address: "0x6982508145454ce325ddbe47a25d4ec3d2311933" },
};

export const pairsPepe = {
  id: 24478,
  name: "Pepe",
  symbol: "PEPE",
  num_market_pairs: 3,
  market_pairs: [
    { exchange: { id: 270, name: "Binance", slug: "binance" }, market_pair: "PEPE/USDT", category: "spot", quote: { USD: { price: 0.00001, volume_24h: 300_000_000 } } },
    { exchange: { id: 294, name: "OKX", slug: "okx" }, market_pair: "PEPE/USDT", category: "spot", quote: { USD: { price: 0.00001, volume_24h: 200_000_000 } } },
    { exchange: { id: 1069, name: "Uniswap v3 (Ethereum)", slug: "uniswap-v3" }, market_pair: "PEPE/WETH", category: "spot", quote: { USD: { price: 0.00001, volume_24h: 100_000_000 } } },
  ],
};

export const globalMetrics = {
  btc_dominance: 57.1,
  quote: { USD: { total_market_cap: 3.9e12, total_market_cap_yesterday_percentage_change: -1.8 } },
};

export const exchangesAll = [
  { id: 270, name: "Binance", slug: "binance", is_active: 1 },
  { id: 630, name: "Binance.US", slug: "binance-us", is_active: 1 },
  { id: 89, name: "Coinbase Exchange", slug: "coinbase-exchange", is_active: 1 },
  { id: 24, name: "Kraken", slug: "kraken", is_active: 1 },
  { id: 302, name: "Gate", slug: "gate", is_active: 1 },
];

/** Raw /v1/exchange/assets rows: one coin can sit in several wallets on several chains. */
export const binanceAssets = [
  { balance: 100, platform: { symbol: "ETH" }, currency: { crypto_id: 1, symbol: "BTC", price_usd: 60000 }, wallet_address: "0xa" },
  { balance: 3e12, platform: { symbol: "ETH" }, currency: { crypto_id: 24478, symbol: "PEPE", price_usd: 0.00001 }, wallet_address: "0xb" },
  { balance: 1e12, platform: { symbol: "BNB" }, currency: { crypto_id: 24478, symbol: "PEPE", price_usd: 0.00001 }, wallet_address: "0xc" },
];

export const categoriesAll = [
  { id: "cat-memes", name: "Memes", title: "Memes", description: "long text", num_tokens: 5362, market_cap: 3.2e10 },
  { id: "cat-ai", name: "AI & Big Data", title: "AI & Big Data", description: "long text", num_tokens: 800, market_cap: 2e10 },
];

const memeCoins = [
  { id: 74, name: "Dogecoin", symbol: "DOGE", cmc_rank: 11, quote: { USD: { market_cap: 1.5e10 } } },
  { id: 5994, name: "Shiba Inu", symbol: "SHIB", cmc_rank: 30, quote: { USD: { market_cap: 3.4e9 } } },
  { id: 24478, name: "Pepe", symbol: "PEPE", cmc_rank: 46, quote: { USD: { market_cap: 1.8e9 } } },
];

/** A fetch that answers like the CMC API, based on path and query. */
export function fakeCmcFetch(opts: { pairsForbidden?: boolean; assetsForbidden?: boolean } = {}) {
  const calls: string[] = [];
  const fn = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}?${url.searchParams}`);
    const ok = (data: unknown) => new Response(JSON.stringify({ status: { error_code: 0, credit_count: 1 }, data }), { status: 200 });
    const bad = (status: number, code: number, msg: string) =>
      new Response(JSON.stringify({ status: { error_code: code, error_message: msg, credit_count: 0 } }), { status });
    const p = url.pathname;
    const q = url.searchParams;
    if (p === "/v1/cryptocurrency/map") {
      if (q.get("symbol") === "PEPE") return ok(mapPepe);
      if (q.get("symbol") === "PEPEC") return ok([{ id: 99999, rank: null, name: "Pepe Classic", symbol: "PEPEC", slug: "pepe-classic", is_active: 1 }]);
      return bad(400, 400, `Invalid value for "symbol": "${q.get("symbol")}"`);
    }
    if (p === "/v2/cryptocurrency/quotes/latest") {
      const ids = q.get("id")!.split(",");
      const all: Record<string, unknown> = { "24478": quotePepe, "99999": quoteFake };
      return ok(Object.fromEntries(ids.map((id) => [id, all[id]])));
    }
    if (p === "/v2/cryptocurrency/info") {
      if (q.get("address")) {
        return q.get("address") === "0x6982508145454ce325ddbe47a25d4ec3d2311933"
          ? ok({ "24478": infoPepe })
          : bad(400, 400, 'Invalid value for "address"');
      }
      const ids = q.get("id")!.split(",");
      return ok(Object.fromEntries(ids.filter((id) => id === "24478").map((id) => [id, infoPepe])));
    }
    if (p === "/v2/cryptocurrency/market-pairs/latest") {
      if (opts.pairsForbidden) return bad(403, 1006, "Your API Key subscription plan doesn't support this endpoint.");
      return q.get("id") === "24478" ? ok(pairsPepe) : ok({ id: Number(q.get("id")), num_market_pairs: 0, market_pairs: [] });
    }
    if (p === "/v1/global-metrics/quotes/latest") return ok(globalMetrics);
    if (p === "/v1/exchange/map") return ok(exchangesAll);
    if (p === "/v1/exchange/assets") {
      if (opts.assetsForbidden) return bad(403, 1006, "Your API Key subscription plan doesn't support this endpoint.");
      return ok(q.get("id") === "270" ? binanceAssets : []);
    }
    if (p === "/v1/cryptocurrency/categories") return ok(categoriesAll);
    if (p === "/v1/cryptocurrency/category") {
      const cat = categoriesAll.find((c) => c.id === q.get("id"));
      return cat ? ok({ ...cat, coins: cat.id === "cat-memes" ? memeCoins : [] }) : bad(400, 400, "Invalid category id");
    }
    if (p === "/v1/cryptocurrency/trending/latest") return bad(403, 1006, "Your API Key subscription plan doesn't support this endpoint.");
    return bad(404, 404, "not found");
  }) as typeof fetch;
  return { fetch: fn, calls };
}
