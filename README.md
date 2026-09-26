# Receipts

**Fact-check any crypto post with live CoinMarketCap data.** Paste an X post link, the post's text, a `$TICKER` or a contract address. Receipts pulls out every claim the post makes ("up 300% this week", "low cap gem", "listed on Binance", "#1 AI coin", "volume exploding") and checks each one against the CoinMarketCap API. Every verdict shows the exact CMC request and response behind it: the receipts.

- **Live site:** https://receipts-orpin-eight.vercel.app
- **Demo video:** https://youtu.be/YfdCPgLGxBw
- **BUIDL page:** https://dorahacks.io/buidl/49157
- **X post:** https://x.com/Anish_Is_Busy/status/2103857282866114888
- **Track:** AI Agents and Automation
- Built for [Build with CMC: API Hackathon](https://dorahacks.io/hackathon/coinmarketcap-api-202609/detail) on DoraHacks.

It checks facts. It never says whether to buy or sell.

## What it does

1. **Reads the post.** Tweet links are read with X's free public oEmbed endpoint (no key). Text, tickers and addresses work directly. There's also a bookmarklet: select text on any page, click it, and Receipts opens with that text.
2. **Finds the coins and the claims.** An LLM (Gemini Flash, free tier) turns the post into a strict JSON list of coins and claims (schema in [`lib/claims/schema.ts`](lib/claims/schema.ts)). The LLM never produces numbers or verdicts. If it's down or rate-limited, a rule-based extractor takes over.
3. **Resolves each coin on CMC.** `$PEPE` → every coin on CMC using that ticker. We pick the best-ranked one and show the others as **ticker impostors**, a common scam trick. Contract addresses (EVM and Solana) resolve through `/v2/cryptocurrency/info?address=`.
4. **Checks every claim with plain code** ([`lib/claims/checkers.ts`](lib/claims/checkers.ts)), choosing the CMC calls each one needs: quotes for price, cap and volume claims, categories for "#1 meme coin", the exchange's wallet holdings for "listed on Binance". Each claim is marked **True**, **False**, **Misleading**, **Can't check** (team, audits, "next 100x") or **Needs plan** (endpoint not on our API tier).
5. **Builds a coin card** with price, changes, rank, market cap, volume and supply, plus **red flags** computed from the data: volume bigger than market cap, unverified (self-reported) supply, added in the last 30 days, only a few market pairs, most volume on one exchange (when market pairs are on the plan), big 90-day drop, other coins sharing the ticker.
6. **Shows the receipts.** Every number links to the CMC call it came from, with the trimmed JSON response. Results get a shareable `/r/<id>` link and a "Reply to the post on X" button.

### Why this needs an agent, not one API call

A post is free text. Before any API call you have to work out which coins it means (a ticker can match many coins), which sentences are checkable facts, and which endpoint can prove or disprove each one. "Listed on Binance" needs the exchange's data, "top 10" needs rank, "#1 AI coin" needs the right CMC category and the coin's place in it, "volume exploding" needs 24h volume change, "low cap" needs market cap and fully diluted value, and "team is doxxed" can't be checked with market data at all. Receipts plans those calls, runs them in batches, and ties each verdict to its evidence.

## CoinMarketCap endpoints used

| Endpoint | What for |
|---|---|
| `GET /v1/cryptocurrency/map?symbol=` | Ticker → CMC id, and every other coin with the same ticker (impostors) |
| `GET /v1/cryptocurrency/map?slug=` | Coin name → CMC id |
| `GET /v2/cryptocurrency/info?address=` | Contract address → coin |
| `GET /v2/cryptocurrency/info?id=` | Logo, tags, platform, date added, CMC notices |
| `GET /v2/cryptocurrency/quotes/latest?id=` | Price, 1h–90d change, rank, market cap, FDV, volume, volume change, supply, market pair count (all coins in one batched call) |
| `GET /v1/cryptocurrency/categories` | Sector name in the post ("AI coins", "memes") → CMC category |
| `GET /v1/cryptocurrency/category?id=` | Top 100 coins in that category: "#1 meme coin", "top 10 AI token" claims |
| `GET /v1/exchange/map` | Exchange name in the post ("Coinbase", "Gate.io") → CMC exchange id |
| `GET /v1/exchange/assets?id=` | Coins in the exchange's own wallets (proof-of-reserves data): "listed on Binance" claims |
| `GET /v2/cryptocurrency/market-pairs/latest?id=` | First choice for "listed on X" and share of volume on one exchange. Blocked on our plan, so the app falls back to `exchange/assets` |
| `GET /v1/global-metrics/quotes/latest` | "Whole market is pumping" claims, market context line |
| `GET /v1/cryptocurrency/trending/latest` | "Trending" claims |
| `GET /v1/cryptocurrency/listings/historical` | Base-rate line on the card ("coins ranked #101–200 were still in the top 200 six months later 72% of the time"). 12 monthly snapshots of the top 1000, precomputed once by [`scripts/base-rates.ts`](scripts/base-rates.ts) into [`lib/baseRatesData.ts`](lib/baseRatesData.ts), never called live |
| `GET /v1/key/info` | Plan and credit check (`/api/status`, `bun run probe`) |

### A real request and response

The coin card and most checks come from one batched quotes call. This is a real call from the build (trimmed to the fields Receipts reads; the full response for every call is shown in the app's receipts panel):

```sh
curl -H "X-CMC_PRO_API_KEY: $CMC_API_KEY" \
  "https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest?id=1,24478&convert=USD"
```

```json
{
  "status": { "timestamp": "2026-09-25T16:28:35.112Z", "error_code": 0, "credit_count": 1 },
  "data": {
    "24478": {
      "id": 24478,
      "name": "Pepe",
      "symbol": "PEPE",
      "cmc_rank": 46,
      "num_market_pairs": 716,
      "date_added": "2023-04-17T06:18:08.000Z",
      "max_supply": 413772355107943.94,
      "circulating_supply": 413772355107943.94,
      "self_reported_market_cap": null,
      "quote": {
        "USD": {
          "price": 0.000004453436380606,
          "volume_24h": 375430472.43,
          "volume_change_24h": -10.6523,
          "percent_change_24h": -0.37497057,
          "percent_change_7d": 16.62001192,
          "percent_change_90d": 82.25627034,
          "market_cap": 1842708859.53,
          "fully_diluted_market_cap": 1842708859.53,
          "last_updated": "2026-09-25T16:27:03.000Z"
        }
      }
    }
  }
}
```

From this one response, a post saying "$PEPE is up 300% this week and still a low cap gem, volume exploding" gets three verdicts: **False** (+16.6% over 7d), **False** ($1.84B market cap, rank #46) and **False** (volume down 11% in 24h).

## How it's built

```
src/            Vite + React + Tailwind front end (home page, /r/<id> result page)
api/            Vercel serverless functions
  check.ts        POST /api/check   {input} → full result, saved for /r/<id>
  result.ts       GET  /api/result?id=
  status.ts       GET  /api/status  (CMC plan, what's configured)
  keepalive.ts    daily Vercel Cron job so the free Redis never goes idle
lib/
  check.ts        the pipeline: read → extract → resolve → fetch → check
  cmc/client.ts   CMC client: caching, stale fallback, one receipt per call
  cmc/endpoints.ts  typed (zod) wrappers for each endpoint
  claims/         claim schema, Gemini extractor, rule-based fallback, checkers,
                  exchange/category name matching (lookup.ts)
  card.ts         coin card and red flags
  detect.ts       tweet links, cashtags, EVM/Solana addresses
test/           vitest tests (fake CMC responses in the real format)
scripts/        probe.ts (which endpoints work on this key), base-rates.ts, warm-cache.ts
```

- **The API key never reaches the browser.** All CMC and LLM calls run in the serverless functions.
- **Caching keeps credit use low and the site up.** Quotes are cached 60s, map/info/categories 24h, exchange wallets 6h, category members 1h, in Upstash Redis. Big responses (the ~1,000-exchange map, 400 KB of wallet rows) are cut to the fields we use before caching. Every good response is also kept for 30 days as a stale copy, so if CMC rate-limits us, the site shows the last known data and labels it "stale".
- **Gemini gets 12 seconds.** It usually answers in about 3, but sometimes stalls; past the limit the rule-based extractor answers instead.
- **Same text, same claims:** LLM extractions are cached forever by text hash, so repeat checks don't use LLM quota.
- **Numbers come only from CMC through plain code.** The LLM only reads the post.

## Run it locally

Needs [bun](https://bun.sh).

```sh
bun install
cp .env.example .env      # add CMC_API_KEY (required), GEMINI_API_KEY (optional)
bun run dev:api           # API on :3001
bun run dev               # site on :5173 (proxies /api)
bun run test              # 45 tests, no keys needed
bun run probe             # which CMC endpoints your key can use
bun run warm-cache        # pre-fill exchange + category data in Redis
```

Without Redis env vars, results are kept in memory. Without a Gemini key, the rule-based extractor is used.

## What the CMC API made possible, and where it got in the way

**Made possible**

- `/v1/cryptocurrency/map?symbol=` returns *every* coin with a ticker, with rank. That one call is the whole "ticker impostors" feature: `$TRUMP` matches 60 coins on CMC, and a shill post never says which one it means.
- `/v2/cryptocurrency/info?address=` turns a pasted contract address into a coin with no extra lookup service.
- `/v1/cryptocurrency/categories` + `/v1/cryptocurrency/category` answer "is this really the #1 AI coin?" in two calls (1 credit each for the top 100).
- `/v1/exchange/assets` (exchange wallet holdings) gave us a way to check "listed on Binance" when market pairs were off our plan.
- `quotes/latest` is very rich for 1 credit: 1h to 90d changes, `volume_change_24h`, `num_market_pairs`, `date_added`, FDV, and `self_reported_market_cap`. Most claim types ("up 300% this week", "low cap", "volume exploding", "just launched", "fixed supply") and most red flags come from this single batched call.
- Clear error codes (`1006` "plan doesn't support this endpoint") let the app show a clean "needs plan" verdict instead of breaking.

**Got in the way**

- `/v2/cryptocurrency/market-pairs/latest` and `/v1/cryptocurrency/trending/latest` returned `403` / `1006` on our key during the event. "Listed on Binance" is one of the most common shill claims, so we check it another way: `/v1/exchange/assets` lists the coins in an exchange's own wallets, and an exchange holding $360M of PEPE is strong evidence PEPE trades there. It's weaker than market pairs: many exchanges (Coinbase, Kraken, Upbit) publish no wallet data, and a coin missing from the wallets isn't proof it isn't listed, so those claims come back "can't check". "Trending" claims still show "needs plan".
- `listings/historical` only reaches back 12 months on our plan, so the base-rate stat uses "six months later" inside that window instead of a longer history.
- `ohlcv/historical` returned `403`, so "down 90% from its peak" can't be checked from all-time highs.
- `map?symbol=` has no quote data, so picking the "real" coin among impostors uses the map's `rank` field; unranked copycats all tie.
- The free plan drops back to Basic when judging starts, so everything historical had to be precomputed, and every live response is cached with a 30-day stale copy so the site keeps working if calls are rate-limited or an endpoint leaves our plan. `bun run warm-cache` fills those copies for the main exchanges and sectors before the plan changes.

## License

MIT

## Credits

Demo video music: "Wallpaper" by Kevin MacLeod (incompetech.com)  
Licensed under Creative Commons: By Attribution 4.0  
http://creativecommons.org/licenses/by/4.0/
