// Shapes shared by the API functions and the React app.

export type Verdict = "true" | "false" | "misleading" | "unverifiable" | "needs_plan";

/** One CMC request and a trimmed copy of its response: the "receipt" behind a number. */
export interface Receipt {
  id: string;
  endpoint: string;
  params: Record<string, string>;
  status: number;
  ok: boolean;
  errorCode?: number;
  errorMessage?: string;
  credits?: number;
  cache: "miss" | "hit" | "stale";
  fetchedAt: string;
  response: unknown;
}

export interface Evidence {
  label: string;
  value: string;
  receiptId?: string;
}

export interface ClaimResult {
  id: string;
  quote: string;
  kind: string;
  coin: string | null;
  verdict: Verdict;
  summary: string;
  evidence: Evidence[];
}

export interface RedFlag {
  id: string;
  severity: "high" | "medium" | "info";
  text: string;
  receiptId?: string;
}

export interface Impostor {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  rank: number | null;
}

export interface CoinCard {
  id: number;
  name: string;
  symbol: string;
  slug: string;
  logo: string | null;
  rank: number | null;
  price: number | null;
  change: Record<"1h" | "24h" | "7d" | "30d" | "60d" | "90d", number | null>;
  marketCap: number | null;
  selfReportedMarketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  volumeChange24h: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  dateAdded: string | null;
  numMarketPairs: number | null;
  tags: string[];
  platform: string | null;
  matchedBy: "symbol" | "address" | "name";
  query: string;
  redFlags: RedFlag[];
  impostors: Impostor[];
  baseRate: string | null;
  receiptIds: string[];
}

export interface MarketContext {
  totalMarketCap: number | null;
  totalMarketCapChange24h: number | null;
  btcDominance: number | null;
  receiptId?: string;
}

export interface CheckResult {
  id: string;
  createdAt: string;
  input: {
    kind: "tweet" | "text" | "ticker" | "address";
    raw: string;
    text: string;
    tweet?: { url: string; author: string; authorUrl: string };
  };
  coins: CoinCard[];
  claims: ClaimResult[];
  unresolved: string[];
  market: MarketContext | null;
  receipts: Receipt[];
  extractor: "gemini" | "fallback";
  notes: string[];
}
