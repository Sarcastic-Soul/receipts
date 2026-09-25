# Receipts

**Fact-check any crypto post with live CoinMarketCap data.** Paste an X post link, the post's text, a `$TICKER` or a contract address. Receipts pulls out every claim the post makes ("up 300% this week", "low cap gem", "listed on Binance", "volume exploding") and checks each one against the CoinMarketCap API. Every verdict shows the exact CMC request and response behind it: the receipts.

- **Live site:** _TBD_
- **Demo video:** _TBD_
- **Track:** AI Agents and Automation
- Built for [Build with CMC: API Hackathon](https://dorahacks.io/hackathon/coinmarketcap-api-202609/detail) on DoraHacks.

It checks facts. It never says whether to buy or sell.

## What it does

1. **Reads the post.** Tweet links are read with X's free public oEmbed endpoint (no key). Text, tickers and addresses work directly. There's also a bookmarklet: select text on any page, click it, and Receipts opens with that text.
2. **Finds the coins and the claims.** An LLM (Gemini Flash, free tier) turns the post into a strict JSON list of coins and claims (schema in [`lib/claims/schema.ts`](lib/claims/schema.ts)). The LLM never produces numbers or verdicts. If it's down or rate-limited, a rule-based extractor takes over.
3. **Resolves each coin on CMC.** `$PEPE` → every coin on CMC using that ticker. We pick the best-ranked one and show the others as **ticker impostors**, a common scam trick. Contract addresses (EVM and Solana) resolve through `/v2/cryptocurrency/info?address=`.
4. **Checks every claim with plain code** ([`lib/claims/checkers.ts`](lib/claims/checkers.ts)) and marks it **True**, **False**, **Misleading**, **Can't check** (team, audits, "next 100x") or **Needs plan** (endpoint not on our API tier).
5. **Builds a coin card** with price, changes, rank, market cap, volume and supply, plus **red flags** computed from the data: volume bigger than market cap, unverified (self-reported) supply, added in the last 30 days, only a few market pairs, most volume on one exchange, big 90-day drop, other coins sharing the ticker.
6. **Shows the receipts.** Every number links to the CMC call it came from, with the trimmed JSON response. Results get a shareable `/r/<id>` link and a "Reply to the post on X" button.

### Why this needs an agent, not one API call

A post is free text. Before any API call you have to work out which coins it means (a ticker can match many coins), which sentences are checkable facts, and which endpoint can prove or disprove each one. "Listed on Binance" needs market pairs, "top 10" needs rank, "volume exploding" needs 24h volume change, "low cap" needs market cap and fully diluted value, and "team is doxxed" can't be checked with market data at all. Receipts plans those calls, runs them in batches, and ties each verdict to its evidence.

## CoinMarketCap endpoints used

| Endpoint | What for |
|---|---|
| `GET /v1/cryptocurrency/map?symbol=` | Ticker → CMC id, and every other coin with the same ticker (impostors) |
| `GET /v1/cryptocurrency/map?slug=` | Coin name → CMC id |
| `GET /v2/cryptocurrency/info?address=` | Contract address → coin |
| `GET /v2/cryptocurrency/info?id=` | Logo, tags, platform, date added, CMC notices |
| `GET /v2/cryptocurrency/quotes/latest?id=` | Price, 1h–90d change, rank, market cap, FDV, volume, volume change, supply, market pair count (all coins in one batched call) |
| `GET /v2/cryptocurrency/market-pairs/latest?id=` | "Listed on X" claims, share of volume on one exchange |
| `GET /v1/global-metrics/quotes/latest` | "Whole market is pumping" claims, market context line |
| `GET /v1/cryptocurrency/trending/latest` | "Trending" claims |
| `GET /v1/cryptocurrency/listings/historical` | Base-rate line on the card ("coins at this rank were still top 500 a year later X% of the time"). Precomputed once by [`scripts/base-rates.ts`](scripts/base-rates.ts), not called live |
| `GET /v1/key/info` | Plan and credit check (`/api/status`, `bun run probe`) |

### A real request and response

_Filled in from [`docs/samples/`](docs/samples/) after running `bun run probe` with a real key._

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
  claims/         claim schema, Gemini extractor, rule-based fallback, checkers
  card.ts         coin card and red flags
  detect.ts       tweet links, cashtags, EVM/Solana addresses
test/           vitest tests (fake CMC responses in the real format)
scripts/        probe.ts (which endpoints work on this key), base-rates.ts
```

- **The API key never reaches the browser.** All CMC and LLM calls run in the serverless functions.
- **Caching keeps credit use low and the site up.** Quotes are cached 60s, map/info 24h, market pairs 30 min, in Upstash Redis. Every good response is also kept for 30 days as a stale copy, so if CMC rate-limits us, the site shows the last known data and labels it "stale".
- **Same text, same claims:** LLM extractions are cached forever by text hash, so repeat checks don't use LLM quota.
- **Numbers come only from CMC through plain code.** The LLM only reads the post.

## Run it locally

Needs [bun](https://bun.sh).

```sh
bun install
cp .env.example .env      # add CMC_API_KEY (required), GEMINI_API_KEY (optional)
bun run dev:api           # API on :3001
bun run dev               # site on :5173 (proxies /api)
bun run test              # 34 tests, no keys needed
bun run probe             # which CMC endpoints your key can use
```

Without Redis env vars, results are kept in memory. Without a Gemini key, the rule-based extractor is used.

## What the CMC API made possible, and where it got in the way

_To be written from real use during the build._

## License

MIT
