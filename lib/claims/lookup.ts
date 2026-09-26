import type { Category, Exchange } from "../cmc/endpoints.js";

// Match the exchange or sector name a post uses ("Coinbase", "AI coins") to the
// entry CMC uses ("Coinbase Exchange", "AI & Big Data"). Plain string rules, no LLM.

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const EXCHANGE_ALIASES: Record<string, string> = {
  coinbase: "coinbase-exchange",
  coinbasepro: "coinbase-exchange",
  gateio: "gate",
  huobi: "htx",
  cryptocom: "crypto-com-exchange",
  okex: "okx",
};

/** Exact name or slug first, then the shortest name that starts with it ("Coinbase" -> "Coinbase Exchange"). */
export function matchExchange(name: string, exchanges: Exchange[]): Exchange | null {
  const want = normalize(name);
  if (!want) return null;
  const alias = EXCHANGE_ALIASES[want];
  if (alias) {
    const hit = exchanges.find((e) => e.slug === alias);
    if (hit) return hit;
  }
  const exact = exchanges.find((e) => normalize(e.name) === want || normalize(e.slug) === want);
  if (exact) return exact;
  const prefixed = exchanges.filter((e) => normalize(e.name).startsWith(want));
  return prefixed.sort((a, b) => a.name.length - b.name.length)[0] ?? null;
}

const CATEGORY_ALIASES: Record<string, string> = {
  ai: "AI & Big Data",
  artificialintelligence: "AI & Big Data",
  aiagent: "AI Agents",
  meme: "Memes",
  memecoin: "Memes",
  layer1: "Layer 1",
  l1: "Layer 1",
  layer2: "Layer 2",
  l2: "Layer 2",
  rwa: "Real World Assets Protocols",
  realworldasset: "Real World Assets Protocols",
  gamefi: "Gaming",
  game: "Gaming",
  privacy: "Privacy Coins",
  privacycoin: "Privacy Coins",
  dex: "Decentralized Exchange (DEX) Token",
  cex: "Centralized Exchange (CEX) Token",
  exchange: "Centralized Exchange (CEX) Token",
  dog: "Doggone Doggerel",
  dogcoin: "Doggone Doggerel",
  cat: "Cat-Themed",
  catcoin: "Cat-Themed",
  nft: "NFTs & Collectibles",
  oracle: "Oracles",
  pumpfun: "Pump Fun Ecosystem",
};

/** "AI coins" -> "AI & Big Data", "meme" -> "Memes", "DePIN" -> "DePIN". */
export function matchCategory(name: string, cats: Category[]): Category | null {
  const want = normalize(name.replace(/\b(coins?|tokens?|sector|projects?|narrative|space|plays?)\b/gi, ""));
  if (!want) return null;
  const singular = want.replace(/s$/, "");
  const alias = CATEGORY_ALIASES[want] ?? CATEGORY_ALIASES[singular];
  if (alias) {
    const hit = cats.find((c) => c.name === alias);
    if (hit) return hit;
  }
  return cats.find((c) => [want, singular, `${singular}s`].includes(normalize(c.name))) ?? null;
}
