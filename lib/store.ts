import { Redis } from "@upstash/redis";

// Small key/value store. Uses Upstash Redis when its env vars are set,
// otherwise an in-memory map (fine for local dev and tests).

export interface Store {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  incr(key: string, ttlSeconds: number): Promise<number>;
}

class MemoryStore implements Store {
  private map = new Map<string, { value: unknown; expires: number | null }>();

  async get<T>(key: string): Promise<T | null> {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (hit.expires !== null && hit.expires < Date.now()) {
      this.map.delete(key);
      return null;
    }
    return hit.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number) {
    this.map.set(key, { value, expires: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null });
  }

  async incr(key: string, ttlSeconds: number) {
    const current = ((await this.get<number>(key)) ?? 0) + 1;
    const existing = this.map.get(key);
    this.map.set(key, { value: current, expires: existing?.expires ?? Date.now() + ttlSeconds * 1000 });
    return current;
  }
}

class RedisStore implements Store {
  constructor(private redis: Redis) {}

  async get<T>(key: string) {
    return (await this.redis.get<T>(key)) ?? null;
  }

  async set(key: string, value: unknown, ttlSeconds?: number) {
    if (ttlSeconds) await this.redis.set(key, value, { ex: ttlSeconds });
    else await this.redis.set(key, value);
  }

  async incr(key: string, ttlSeconds: number) {
    const n = await this.redis.incr(key);
    if (n === 1) await this.redis.expire(key, ttlSeconds);
    return n;
  }
}

let store: Store | null = null;

export function getStore(): Store {
  if (store) return store;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  store = url && token ? new RedisStore(new Redis({ url, token })) : new MemoryStore();
  return store;
}

export function isPersistent() {
  return getStore() instanceof RedisStore;
}

/** For tests. */
export function setStore(s: Store) {
  store = s;
}

export { MemoryStore };
