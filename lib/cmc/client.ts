import type { Receipt } from "../types.js";
import { getStore } from "../store.js";

// Override only for local testing against a mock server.
const BASE = process.env.CMC_BASE_URL || "https://pro-api.coinmarketcap.com";

// CMC error codes that mean "your plan doesn't include this endpoint".
const PLAN_ERROR_CODES = new Set([1003, 1006]);

// Keep a copy of every good response this long, so we can serve stale data
// if CMC rate-limits us or the key loses access to an endpoint.
const STALE_KEEP_SECONDS = 60 * 60 * 24 * 30;

// After a "not on your plan" answer, skip that endpoint for a while instead of asking again.
const PLAN_DENIED_SECONDS = 60 * 60 * 6;

export interface CmcResult<T> {
  ok: boolean;
  data: T | null;
  receiptId: string;
  /** True when the endpoint is not on the current API plan. */
  needsPlan: boolean;
  status: number;
  errorMessage?: string;
}

interface CachedBody {
  body: { data?: unknown; status?: { credit_count?: number } };
  fetchedAt: string;
}

type Fetch = typeof fetch;

/**
 * One CMC session per check request. Every call is recorded as a Receipt so the UI
 * can show the exact request and response behind each number.
 */
export class CmcSession {
  readonly receipts: Receipt[] = [];

  constructor(
    private apiKey: string | undefined = process.env.CMC_API_KEY,
    private fetchImpl: Fetch = fetch,
  ) {}

  async get<T>(
    endpoint: string,
    params: Record<string, string>,
    ttlSeconds: number,
    pick?: (data: unknown) => unknown,
  ): Promise<CmcResult<T>> {
    const query = new URLSearchParams(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
    const cacheKey = `cmc:${endpoint}?${query}`;
    const store = getStore();
    const existing = this.receipts.find((r) => r.endpoint === endpoint && sameParams(r.params, params));

    let cached: CachedBody | null = null;
    try {
      cached = await store.get<CachedBody>(cacheKey);
    } catch {
      // cache down: carry on without it
    }
    const age = cached ? (Date.now() - Date.parse(cached.fetchedAt)) / 1000 : Infinity;

    if (cached && age < ttlSeconds) {
      return this.finish<T>(existing, endpoint, params, 200, cached, "hit", pick);
    }

    const deniedKey = `cmc-denied:${endpoint}`;
    const denied = await store.get<string>(deniedKey).catch(() => null);
    if (denied) {
      if (cached) return this.finish<T>(existing, endpoint, params, 200, cached, "stale", pick);
      return this.fail<T>(endpoint, params, 403, 1006, denied);
    }

    if (!this.apiKey) {
      if (cached) return this.finish<T>(existing, endpoint, params, 200, cached, "stale", pick);
      return this.fail<T>(endpoint, params, 0, undefined, "CMC_API_KEY is not set on the server");
    }

    let status = 0;
    let json: { data?: unknown; status?: { error_code?: number | string; error_message?: string | null; credit_count?: number } } = {};
    try {
      const res = await this.fetchImpl(`${BASE}${endpoint}?${query}`, {
        headers: { "X-CMC_PRO_API_KEY": this.apiKey, Accept: "application/json" },
      });
      status = res.status;
      json = await res.json().catch(() => ({}));
    } catch (err) {
      if (cached) return this.finish<T>(existing, endpoint, params, 200, cached, "stale", pick);
      return this.fail<T>(endpoint, params, 0, undefined, `Network error: ${(err as Error).message}`);
    }

    const errorCode = Number(json.status?.error_code ?? 0);
    if (status === 200 && errorCode === 0) {
      const fresh: CachedBody = { body: { data: json.data, status: { credit_count: json.status?.credit_count } }, fetchedAt: new Date().toISOString() };
      try {
        await store.set(cacheKey, fresh, STALE_KEEP_SECONDS);
      } catch {
        // ignore cache write errors
      }
      return this.finish<T>(existing, endpoint, params, status, fresh, "miss", pick);
    }

    if (status === 403 || PLAN_ERROR_CODES.has(errorCode)) {
      await store.set(deniedKey, json.status?.error_message ?? "Not on this API plan", PLAN_DENIED_SECONDS).catch(() => {});
    }

    // Error from CMC. Fall back to the last good copy if we have one.
    if (cached) return this.finish<T>(existing, endpoint, params, 200, cached, "stale", pick);
    return this.fail<T>(endpoint, params, status, errorCode, json.status?.error_message ?? `HTTP ${status}`);
  }

  private finish<T>(
    existing: Receipt | undefined,
    endpoint: string,
    params: Record<string, string>,
    status: number,
    cached: CachedBody,
    cache: Receipt["cache"],
    pick?: (data: unknown) => unknown,
  ): CmcResult<T> {
    const data = cached.body.data as T;
    if (existing) return { ok: true, data, receiptId: existing.id, needsPlan: false, status };
    const receipt: Receipt = {
      id: `r${this.receipts.length + 1}`,
      endpoint,
      params,
      status,
      ok: true,
      credits: cached.body.status?.credit_count,
      cache,
      fetchedAt: cached.fetchedAt,
      response: trim({ data: pick ? pick(data) : data, status: { credit_count: cached.body.status?.credit_count } }),
    };
    this.receipts.push(receipt);
    return { ok: true, data, receiptId: receipt.id, needsPlan: false, status };
  }

  private fail<T>(
    endpoint: string,
    params: Record<string, string>,
    status: number,
    errorCode: number | undefined,
    errorMessage: string,
  ): CmcResult<T> {
    const needsPlan = status === 403 || status === 402 || (errorCode !== undefined && PLAN_ERROR_CODES.has(errorCode));
    const receipt: Receipt = {
      id: `r${this.receipts.length + 1}`,
      endpoint,
      params,
      status,
      ok: false,
      errorCode,
      errorMessage,
      cache: "miss",
      fetchedAt: new Date().toISOString(),
      response: { status: { error_code: errorCode, error_message: errorMessage } },
    };
    this.receipts.push(receipt);
    return { ok: false, data: null, receiptId: receipt.id, needsPlan, status, errorMessage };
  }
}

function sameParams(a: Record<string, string>, b: Record<string, string>) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/** Shorten a response so receipts stay readable: long arrays and strings are cut. */
export function trim(value: unknown, depth = 0): unknown {
  if (depth > 6) return "…";
  if (typeof value === "string") return value.length > 200 ? `${value.slice(0, 200)}…` : value;
  if (Array.isArray(value)) {
    const head = value.slice(0, 6).map((v) => trim(v, depth + 1));
    return value.length > 6 ? [...head, `…${value.length - 6} more`] : head;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, trim(v, depth + 1)]));
  }
  return value;
}
