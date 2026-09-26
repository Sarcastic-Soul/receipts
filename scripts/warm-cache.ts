// Fill the shared cache (Upstash Redis from .env) with the exchange and category data
// that exchange and sector claims need: `bun run warm-cache`.
//
// The free Startup plan ends on 30 Sep and some of these endpoints may not be on Basic.
// Every good response is kept for 30 days as a stale copy, so running this on 30 Sep keeps
// these checks working through judging (1–16 Oct).

import { CmcSession } from "../lib/cmc/client";
import { categories, categoryCoins, exchangeAssets, exchangeMap } from "../lib/cmc/endpoints";
import { matchCategory, matchExchange } from "../lib/claims/lookup";

const EXCHANGES = [
  "Binance", "Coinbase", "OKX", "Bybit", "KuCoin", "Gate", "Kraken", "MEXC", "Bitget", "HTX",
  "Upbit", "Crypto.com", "Bitfinex", "Bitstamp", "Binance.US", "Gemini", "Bithumb", "BingX",
];

const SECTORS = [
  "AI", "AI Agents", "meme", "Layer 1", "Layer 2", "DeFi", "RWA", "Gaming", "DePIN", "Privacy",
  "DEX", "CEX", "Stablecoin", "Metaverse", "NFT", "Oracle", "Storage", "Solana Ecosystem", "dog", "cat",
];

const cmc = new CmcSession();
const report = (label: string, res: { ok: boolean; errorMessage?: string }) =>
  console.log(`${res.ok ? "OK  " : "FAIL"} ${label}${res.ok ? "" : ` -> ${res.errorMessage}`}`);

const exMap = await exchangeMap(cmc);
report("exchange/map", exMap);
for (const name of EXCHANGES) {
  const ex = exMap.data ? matchExchange(name, exMap.data) : null;
  if (!ex) {
    console.log(`SKIP ${name}: no match`);
    continue;
  }
  const res = await exchangeAssets(cmc, ex.id);
  report(`exchange/assets ${ex.name} (${res.data?.length ?? 0} coins)`, res);
}

const cats = await categories(cmc);
report("categories", cats);
for (const name of SECTORS) {
  const cat = cats.data ? matchCategory(name, cats.data) : null;
  if (!cat) {
    console.log(`SKIP ${name}: no match`);
    continue;
  }
  report(`category ${cat.name}`, await categoryCoins(cmc, cat.id));
}

const credits = cmc.receipts.reduce((s, r) => s + (r.cache === "miss" ? (r.credits ?? 0) : 0), 0);
console.log(`\n${cmc.receipts.length} calls, ${credits} credits used.`);
process.exit(0);
