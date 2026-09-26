// Check which CMC endpoints this key can use, and save real request/response samples.
//   bun scripts/probe.ts
// Most calls cost 1 credit; key/info costs none.

import { mkdirSync, writeFileSync } from "node:fs";

const KEY = process.env.CMC_API_KEY;
if (!KEY) throw new Error("Set CMC_API_KEY in .env");

const PROBES: Array<[string, Record<string, string>]> = [
  ["/v1/key/info", {}],
  ["/v1/cryptocurrency/map", { symbol: "PEPE" }],
  ["/v2/cryptocurrency/info", { id: "24478" }],
  ["/v2/cryptocurrency/info", { address: "0x6982508145454ce325ddbe47a25d4ec3d2311933" }],
  ["/v2/cryptocurrency/quotes/latest", { id: "1,24478" }],
  ["/v1/global-metrics/quotes/latest", {}],
  ["/v1/cryptocurrency/categories", { limit: "5" }],
  ["/v1/cryptocurrency/category", { id: "6051a82566fc1b42617d6dc6", limit: "5" }],
  ["/v1/exchange/map", { limit: "5" }],
  ["/v1/exchange/assets", { id: "270" }],
  ["/v2/cryptocurrency/market-pairs/latest", { id: "24478", limit: "5" }],
  ["/v1/cryptocurrency/trending/latest", { limit: "5" }],
  ["/v1/cryptocurrency/listings/historical", { date: "2024-01-01", limit: "5" }],
  ["/v2/cryptocurrency/quotes/historical", { id: "1", count: "2", interval: "daily" }],
  ["/v2/cryptocurrency/ohlcv/historical", { id: "1", count: "2" }],
];

mkdirSync(new URL("../docs/samples/", import.meta.url), { recursive: true });

for (const [path, params] of PROBES) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://pro-api.coinmarketcap.com${path}${qs ? `?${qs}` : ""}`, {
    headers: { "X-CMC_PRO_API_KEY": KEY, Accept: "application/json" },
  });
  const body = (await res.json().catch(() => ({}))) as { status?: { error_code?: number; error_message?: string; credit_count?: number } };
  const ok = res.ok && !body.status?.error_code;
  console.log(`${ok ? "OK  " : "FAIL"} ${res.status} ${path}?${qs}${ok ? ` (${body.status?.credit_count ?? 0} credits)` : ` -> ${body.status?.error_message}`}`);
  if (ok && path !== "/v1/key/info") {
    const name = `${path.replace(/^\//, "").replace(/\//g, "_")}${params.address ? "_address" : ""}.json`;
    writeFileSync(new URL(`../docs/samples/${name}`, import.meta.url), JSON.stringify({ request: `GET ${path}?${qs}`, response: body }, null, 2));
  }
  if (path === "/v1/key/info" && ok) console.log(JSON.stringify((body as { data?: { plan?: unknown } }).data?.plan, null, 2));
  await new Promise((r) => setTimeout(r, 2100));
}
