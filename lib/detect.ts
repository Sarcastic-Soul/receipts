// Finds tweet links, cashtags and contract addresses in free text. No network calls.

const TWEET_URL = /https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})/i;
const EVM_ADDRESS = /\b0x[a-fA-F0-9]{40}\b/g;
const SOLANA_ADDRESS = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const CASHTAG = /(?:^|[^\w$])\$([A-Za-z][A-Za-z0-9]{0,11})\b/g;
const BARE_TICKER = /^\$?[A-Za-z][A-Za-z0-9]{1,11}$/;

// Cashtags that are really currencies or common words, not coins.
const NOT_COINS = new Set(["USD", "EUR", "GBP", "INR", "JPY", "CAD", "AUD", "CNY", "K", "M", "B"]);

export type InputKind = "tweet" | "address" | "ticker" | "text";

export function findTweetUrl(text: string): string | null {
  const m = text.match(TWEET_URL);
  return m ? `https://x.com/${m[1]}/status/${m[2]}` : null;
}

export function findAddresses(text: string): string[] {
  const evm = text.match(EVM_ADDRESS) ?? [];
  // Solana addresses are base58. Require digits and both cases so long words don't match.
  const sol = (text.match(SOLANA_ADDRESS) ?? []).filter(
    (s) => /\d/.test(s) && /[A-Z]/.test(s) && /[a-z]/.test(s),
  );
  return unique([...evm.map((a) => a.toLowerCase()), ...sol]);
}

export function findCashtags(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(CASHTAG)) {
    const sym = m[1].toUpperCase();
    if (!NOT_COINS.has(sym)) out.push(sym);
  }
  return unique(out);
}

export function classifyInput(raw: string): InputKind {
  const text = raw.trim();
  if (findTweetUrl(text) && text.split(/\s+/).length === 1) return "tweet";
  if (findAddresses(text).length === 1 && text.split(/\s+/).length === 1) return "address";
  if (BARE_TICKER.test(text)) return "ticker";
  return "text";
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
