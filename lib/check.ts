import { randomBytes } from "node:crypto";
import { buildCard } from "./card.js";
import { CmcSession, type CmcResult } from "./cmc/client.js";
import {
  categories,
  categoryCoins,
  exchangeAssets,
  exchangeMap,
  globalMetrics,
  infoByAddress,
  infoByIds,
  mapBySlug,
  mapBySymbol,
  marketPairs,
  quotesByIds,
  trendingLatest,
  type Category,
  type CategoryDetail,
  type Exchange,
  type ExchangeHolding,
  type MapEntry,
  type MarketPairs,
} from "./cmc/endpoints.js";
import { checkClaim, type CategoryLookup, type CheckContext, type CoinData, type ExchangeLookup } from "./claims/checkers.js";
import { matchCategory, matchExchange, normalize } from "./claims/lookup.js";
import { extractClaims } from "./claims/extract.js";
import type { Claim, Extraction, Mention } from "./claims/schema.js";
import { classifyInput, findAddresses, findCashtags, findTweetUrl } from "./detect.js";
import { fetchTweet, type Tweet } from "./tweet.js";
import type { CheckResult, CoinCard } from "./types.js";

const MAX_COINS = 5;
const MAX_PAIR_LOOKUPS = 3;

export class UserError extends Error {}

export interface CheckDeps {
  cmc?: CmcSession;
  getTweet?: (url: string) => Promise<Tweet>;
  extract?: typeof extractClaims;
  now?: number;
}

export async function runCheck(raw: string, deps: CheckDeps = {}): Promise<CheckResult> {
  const cmc = deps.cmc ?? new CmcSession();
  const input = raw.trim();
  const kind = classifyInput(input);
  const notes: string[] = [];

  // 1. Get the text to check.
  let text = input;
  let tweet: Tweet | undefined;
  if (kind === "tweet") {
    const url = findTweetUrl(input)!;
    try {
      tweet = await (deps.getTweet ?? fetchTweet)(url);
      text = tweet.text;
    } catch {
      throw new UserError("Couldn't read that post from X (it may be deleted, private or from a protected account). Paste the post text instead.");
    }
  }

  // 2. Find coins and claims. A bare ticker or address needs no LLM.
  let extraction: Extraction;
  let extractor: CheckResult["extractor"] = "fallback";
  if (kind === "ticker") {
    extraction = { coins: [{ symbol: input.replace(/^\$/, "").toUpperCase(), name: null, address: null }], claims: [] };
  } else if (kind === "address") {
    extraction = { coins: [{ symbol: null, name: null, address: input }], claims: [] };
  } else {
    const res = await (deps.extract ?? extractClaims)(text);
    extraction = res.extraction;
    extractor = res.extractor;
    if (res.note) notes.push(res.note);
  }
  const mentions = mergeMentions(extraction.coins, text).slice(0, MAX_COINS);
  if (!mentions.length) {
    throw new UserError("No coin found. Add a $TICKER, a coin name or a contract address.");
  }

  // 3. Resolve each mention to a CMC id.
  const resolved = await Promise.all(mentions.map((m) => resolveMention(cmc, m)));
  const unresolved: string[] = [];
  const seen = new Set<number>();
  const coins: Resolved[] = [];
  resolved.forEach((r, i) => {
    if (!r) unresolved.push(mentionLabel(mentions[i]));
    else if (!seen.has(r.entry.id)) {
      seen.add(r.entry.id);
      coins.push(r);
    }
  });

  // 4. Fetch live data for all coins in batched calls.
  const ids = coins.map((c) => c.entry.id);
  const needsTrending = extraction.claims.some((c) => c.kind === "trending");
  const [quotes, infos, global, trending, pairs] = await Promise.all([
    ids.length ? quotesByIds(cmc, ids) : null,
    ids.length ? infoByIds(cmc, ids) : null,
    globalMetrics(cmc),
    needsTrending ? trendingLatest(cmc) : undefined,
    Promise.all(coins.slice(0, MAX_PAIR_LOOKUPS).map((c) => marketPairs(cmc, c.entry.id))),
  ]);

  if (quotes && !quotes.ok) notes.push(`Live quotes failed: ${quotes.errorMessage ?? "unknown error"}.`);
  if (pairs.some((p) => p.needsPlan) && extraction.claims.some((c) => c.kind === "listed_on_exchange")) {
    notes.push("Market pairs (exchange listings) aren't on our CMC API plan, so exchange claims are checked against the exchange's wallet holdings on CMC instead.");
  }

  const cards: CoinCard[] = [];
  const ctx: CheckContext = { coins: new Map(), primary: null, global, trending, unresolved, now: deps.now };
  coins.forEach((c, i) => {
    const pairRes: CmcResult<MarketPairs> | undefined = pairs[i];
    const card = buildCard({
      entry: c.entry,
      matchedBy: c.matchedBy,
      query: c.query,
      impostors: c.impostors,
      mapReceiptId: c.mapReceiptId,
      quote: quotes?.data?.[String(c.entry.id)] ?? null,
      quoteReceiptId: quotes?.receiptId,
      info: infos?.data?.[String(c.entry.id)] ?? null,
      infoReceiptId: infos?.receiptId,
      pairs: pairRes?.data ?? null,
      pairsReceiptId: pairRes?.ok ? pairRes.receiptId : undefined,
      now: deps.now,
    });
    cards.push(card);
    const data: CoinData = { card, quoteReceiptId: quotes?.receiptId, pairs: pairRes };
    if (!ctx.coins.has(card.symbol.toUpperCase())) ctx.coins.set(card.symbol.toUpperCase(), data);
    if (c.query && !ctx.coins.has(c.query.toUpperCase())) ctx.coins.set(c.query.toUpperCase(), data);
    ctx.primary ??= data;
  });

  // Exchange claims for coins beyond the pair-lookup limit.
  for (const claim of extraction.claims) {
    if (claim.kind !== "listed_on_exchange") continue;
    const data = claim.coin ? ctx.coins.get(claim.coin.toUpperCase()) : ctx.primary;
    if (data && !data.pairs) data.pairs = await marketPairs(cmc, data.card.id);
  }

  // Exchange claims without market pairs fall back to the exchange's wallet holdings.
  const needReserves = extraction.claims.filter((c) => {
    if (c.kind !== "listed_on_exchange" || !c.exchange) return false;
    const data = c.coin ? ctx.coins.get(c.coin.toUpperCase()) : ctx.primary;
    return !!data && !data.pairs?.ok;
  });
  ctx.exchanges = await lookUpExchanges(cmc, needReserves, ctx);
  ctx.categories = await lookUpCategories(
    cmc,
    extraction.claims.filter((c) => c.kind === "category_rank" && c.category),
    ctx,
  );

  // 5. Check every claim.
  const claims = extraction.claims.map((claim, i) => checkClaim(claim, ctx, `c${i + 1}`));

  const g = global?.data?.quote.USD;
  return {
    id: newId(),
    createdAt: new Date(deps.now ?? Date.now()).toISOString(),
    input: {
      kind,
      raw: input,
      text,
      tweet: tweet ? { url: tweet.url, author: tweet.author, authorUrl: tweet.authorUrl } : undefined,
    },
    coins: cards,
    claims,
    unresolved,
    market: global?.ok
      ? {
          totalMarketCap: g?.total_market_cap ?? null,
          totalMarketCapChange24h: g?.total_market_cap_yesterday_percentage_change ?? null,
          btcDominance: global.data?.btc_dominance ?? null,
          receiptId: global.receiptId,
        }
      : null,
    receipts: cmc.receipts,
    extractor,
    notes,
  };
}

function claimCoinIds(claims: Claim[], ctx: CheckContext): Set<number> {
  const ids = new Set<number>();
  for (const c of claims) {
    const data = c.coin ? ctx.coins.get(c.coin.toUpperCase()) : ctx.primary;
    if (data) ids.add(data.card.id);
  }
  return ids;
}

async function lookUpExchanges(cmc: CmcSession, claims: Claim[], ctx: CheckContext): Promise<Map<string, ExchangeLookup>> {
  const out = new Map<string, ExchangeLookup>();
  if (!claims.length) return out;
  const names = [...new Set(claims.map((c) => c.exchange!))];
  const coinIds = claimCoinIds(claims, ctx);
  // Receipts show only the exchanges we matched, not all ~1000.
  const map = await exchangeMap(cmc, (data) => {
    const list = data as Exchange[];
    return { exchanges_on_cmc: list.length, matched: names.map((n) => matchExchange(n, list)).filter(Boolean) };
  });
  const assetsById = new Map<number, Awaited<ReturnType<typeof exchangeAssets>>>();
  for (const name of names) {
    const exchange = map.data ? matchExchange(name, map.data) : null;
    if (exchange && !assetsById.has(exchange.id)) {
      assetsById.set(
        exchange.id,
        await exchangeAssets(cmc, exchange.id, (data) => {
          const rows = data as ExchangeHolding[];
          return { coins_held: rows.length, largest: rows.slice(0, 3), claimed_coins: rows.filter((r) => coinIds.has(r.crypto_id)) };
        }),
      );
    }
    out.set(normalize(name), { map, exchange, assets: exchange ? assetsById.get(exchange.id) : undefined });
  }
  return out;
}

async function lookUpCategories(cmc: CmcSession, claims: Claim[], ctx: CheckContext): Promise<Map<string, CategoryLookup>> {
  const out = new Map<string, CategoryLookup>();
  if (!claims.length) return out;
  const names = [...new Set(claims.map((c) => c.category!))];
  const coinIds = claimCoinIds(claims, ctx);
  const list = await categories(cmc, (data) => {
    const cats = data as Category[];
    return { categories_on_cmc: cats.length, matched: names.map((n) => matchCategory(n, cats)).filter(Boolean) };
  });
  const detailById = new Map<string, Awaited<ReturnType<typeof categoryCoins>>>();
  for (const name of names) {
    const category = list.data ? matchCategory(name, list.data) : null;
    if (category && !detailById.has(category.id)) {
      detailById.set(
        category.id,
        await categoryCoins(cmc, category.id, (data) => {
          const d = data as CategoryDetail;
          const coins = d.coins.map((c, i) => ({ position: i + 1, ...c }));
          return { ...d, coins: coins.filter((c) => c.position <= 5 || coinIds.has(c.id)) };
        }),
      );
    }
    out.set(normalize(name), { list, category, detail: category ? detailById.get(category.id) : undefined });
  }
  return out;
}

interface Resolved {
  entry: Pick<MapEntry, "id" | "name" | "symbol" | "slug" | "rank">;
  matchedBy: CoinCard["matchedBy"];
  query: string;
  impostors: MapEntry[];
  mapReceiptId?: string;
}

/** Ticker, name or address to one CMC coin, plus every other coin sharing its ticker. */
export async function resolveMention(cmc: CmcSession, m: Mention): Promise<Resolved | null> {
  if (m.address) {
    const res = assertReachable(await infoByAddress(cmc, m.address.trim()));
    const info = res.data ? Object.values(res.data)[0] : undefined;
    if (!info) return null;
    const bySym = await mapBySymbol(cmc, info.symbol);
    return {
      entry: { id: info.id, name: info.name, symbol: info.symbol, slug: info.slug, rank: null },
      matchedBy: "address",
      query: info.symbol,
      impostors: (bySym.data ?? []).filter((e) => e.id !== info.id),
      mapReceiptId: bySym.ok ? bySym.receiptId : res.receiptId,
    };
  }

  if (m.symbol) {
    const sym = m.symbol.replace(/^\$/, "").toUpperCase();
    const res = assertReachable(await mapBySymbol(cmc, sym));
    const candidates = res.data ?? [];
    if (candidates.length) {
      const pick = pickCandidate(candidates, m.name);
      return {
        entry: pick,
        matchedBy: "symbol",
        query: sym,
        impostors: candidates.filter((e) => e.id !== pick.id),
        mapReceiptId: res.receiptId,
      };
    }
  }

  if (m.name) {
    const slug = m.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return null;
    const res = assertReachable(await mapBySlug(cmc, slug));
    const hit = res.data?.[0];
    if (!hit) return null;
    const bySym = await mapBySymbol(cmc, hit.symbol);
    return {
      entry: hit,
      matchedBy: "name",
      query: m.symbol?.toUpperCase() ?? hit.symbol,
      impostors: (bySym.data ?? []).filter((e) => e.id !== hit.id),
      mapReceiptId: res.receiptId,
    };
  }
  return null;
}

/**
 * CMC answers HTTP 400 for "no coin with that symbol/slug/address": that means not found.
 * Anything else (no key, rate limit, outage) must not be reported as "not on CMC".
 */
function assertReachable<T>(res: CmcResult<T>): CmcResult<T> {
  if (!res.ok && res.status !== 400) {
    throw new UserError(`CoinMarketCap didn't answer (${res.errorMessage ?? `HTTP ${res.status}`}). Try again in a minute.`);
  }
  return res;
}

/** Prefer an exact name match, then the best CMC rank. Unranked coins go last. */
export function pickCandidate(candidates: MapEntry[], name: string | null): MapEntry {
  if (name) {
    const n = name.toLowerCase();
    const exact = candidates.find((c) => c.name.toLowerCase() === n || c.slug === n);
    if (exact) return exact;
  }
  return [...candidates].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity))[0];
}

/** LLM mentions plus anything the regex detectors found that the LLM missed. */
export function mergeMentions(fromLlm: Mention[], text: string): Mention[] {
  const out = [...fromLlm];
  const has = (pred: (m: Mention) => boolean) => out.some(pred);
  for (const sym of findCashtags(text)) {
    if (!has((m) => m.symbol?.toUpperCase().replace(/^\$/, "") === sym)) out.push({ symbol: sym, name: null, address: null });
  }
  for (const address of findAddresses(text)) {
    if (!has((m) => m.address?.toLowerCase() === address.toLowerCase())) out.push({ symbol: null, name: null, address });
  }
  return out.filter((m) => m.symbol || m.name || m.address);
}

function mentionLabel(m: Mention): string {
  return (m.symbol?.toUpperCase().replace(/^\$/, "") ?? m.name ?? m.address ?? "?").toString();
}

function newId(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return [...randomBytes(8)].map((b) => alphabet[b % alphabet.length]).join("");
}
