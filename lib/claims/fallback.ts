import { findAddresses, findCashtags } from "../detect.js";
import { claimDefaults, type Claim, type Extraction, type Mention } from "./schema.js";

// Rule-based claim extraction. Used when no LLM key is set or the LLM call fails,
// so the site still gives useful results. It only knows common phrasings.

const PERIOD_WORDS: Array<[RegExp, Claim["period"]]> = [
  [/\b(hour|1h)\b/i, "1h"],
  [/\b(today|24h|24 hours|day)\b/i, "24h"],
  [/\b(week|7d|7 days)\b/i, "7d"],
  [/\b(month|30d|30 days)\b/i, "30d"],
];

const EXCHANGES = ["binance", "coinbase", "kraken", "okx", "bybit", "kucoin", "gate", "bitget", "mexc", "htx", "upbit", "robinhood"];

export function fallbackExtract(text: string): Extraction {
  const tags = findCashtags(text);
  const coins: Mention[] = [
    ...tags.map((symbol) => ({ symbol, name: null, address: null })),
    ...findAddresses(text).map((address) => ({ symbol: null, name: null, address })),
  ];
  const claims: Claim[] = [];
  // Split on sentence ends, line breaks and emoji, which shill posts use as full stops.
  const sentences = text.split(/(?<=[.!?])\s+|\n+|\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+\s*/u);
  let coin = tags[0] ?? null;

  for (const s of sentences) {
    const quote = s.trim();
    if (!quote) continue;
    // A claim is about the coin named in its sentence, else the last coin named before it.
    coin = findCashtags(quote)[0] ?? coin;
    const move = quote.match(/\b(up|pumped|pumping|gained|mooned|down|dumped|dropped|fell)\s+(?:over\s+|almost\s+)?(\d[\d,.]*)\s*(%|x)/i);
    if (move) {
      const down = /down|dump|drop|fell/i.test(move[1]);
      const n = Number(move[2].replace(/,/g, ""));
      const percent = move[3].toLowerCase() === "x" ? (n - 1) * 100 : n;
      claims.push(claimDefaults({ quote, kind: "price_change", coin, direction: down ? "down" : "up", percent, period: periodOf(quote) }));
    }
    const top = quote.match(/\btop\s+(\d{1,4})\b/i);
    if (top) claims.push(claimDefaults({ quote, kind: "rank", coin, rankLimit: Number(top[1]) }));
    if (/\b(low|micro|small)[\s-]?cap\b/i.test(quote)) {
      claims.push(claimDefaults({ quote, kind: "market_cap", coin, comparator: "below" }));
    }
    if (/\bvolume\b.*\b(explod|pump|spik|surg|insane|huge|up)/i.test(quote)) {
      claims.push(claimDefaults({ quote, kind: "volume_spike", coin, direction: "up" }));
    }
    const listed = quote.match(new RegExp(`\\b(?:listed|listing|live)\\s+on\\s+(${EXCHANGES.join("|")})`, "i"));
    if (listed) claims.push(claimDefaults({ quote, kind: "listed_on_exchange", coin, exchange: listed[1] }));
    if (/\b(fixed|capped|hard[\s-]?capped)\s+supply\b/i.test(quote)) {
      claims.push(claimDefaults({ quote, kind: "fixed_supply", coin }));
    }
    if (/\b(just launched|brand new|new listing|just listed)\b/i.test(quote) && !listed) {
      claims.push(claimDefaults({ quote, kind: "new_listing", coin }));
    }
    if (/\btrending\b/i.test(quote)) claims.push(claimDefaults({ quote, kind: "trending", coin }));
    if (/\b(doxx?ed|audit(ed)?|partnership|whales?)\b/i.test(quote)) {
      claims.push(claimDefaults({ quote, kind: "unverifiable", coin, reason: "Team, audits, partnerships and wallet activity are not in CMC market data" }));
    }
    if (/\b\d{2,5}x\b|\bmoon\b|\bnext\s+\w+\s*(killer|gem)\b|\bundervalued\b|\bdon'?t fade\b/i.test(quote) && !move) {
      claims.push(claimDefaults({ quote, kind: "opinion", coin, reason: "A prediction or opinion, not a fact" }));
    }
  }
  return { coins, claims: claims.slice(0, 12) };
}

function periodOf(s: string): Claim["period"] {
  for (const [re, p] of PERIOD_WORDS) if (re.test(s)) return p;
  return null;
}
