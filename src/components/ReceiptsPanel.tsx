import type { Receipt } from "../../lib/types";

// The "receipts": every CMC request made for this result, with a trimmed response.

export function ReceiptsPanel({ receipts, highlight }: { receipts: Receipt[]; highlight: string | null }) {
  const credits = receipts.reduce((s, r) => s + (r.cache === "miss" ? (r.credits ?? 0) : 0), 0);
  return (
    <div className="space-y-3">
      <p className="font-mono text-xs text-muted">
        {receipts.length} CoinMarketCap request{receipts.length === 1 ? "" : "s"} · {credits} credit{credits === 1 ? "" : "s"} spent
        (cached calls cost nothing). The API key stays on the server.
      </p>
      {receipts.map((r) => (
        <details
          key={r.id}
          id={`receipt-${r.id}`}
          open={highlight === r.id}
          className={`rounded-md border bg-white/50 font-mono text-xs ${highlight === r.id ? "border-ink ring-2 ring-ink" : "border-rule"}`}
        >
          <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2">
            <span className="rounded bg-ink px-1.5 text-paper">{r.id}</span>
            <span className="font-semibold">GET {r.endpoint}</span>
            <span className="text-muted">{new URLSearchParams(r.params).toString()}</span>
            <span className={`ml-auto ${r.ok ? "text-good" : "text-bad"}`}>
              {r.ok ? "200 OK" : `${r.status || "ERR"}${r.errorCode ? ` · error ${r.errorCode}` : ""}`}
            </span>
            <span className="text-muted">{cacheLabel(r)}</span>
          </summary>
          <div className="border-t border-rule px-3 py-2">
            <p className="mb-1 break-all text-muted">
              curl -H "X-CMC_PRO_API_KEY: $CMC_API_KEY" "https://pro-api.coinmarketcap.com{r.endpoint}?
              {new URLSearchParams(r.params).toString()}"
            </p>
            {r.errorMessage && <p className="mb-1 text-bad">{r.errorMessage}</p>}
            <pre className="max-h-96 overflow-auto rounded bg-ink p-3 text-[11px] leading-relaxed text-paper">
              {JSON.stringify(r.response, null, 2)}
            </pre>
            <p className="mt-1 text-muted">Fetched {new Date(r.fetchedAt).toUTCString()}. Long arrays and strings are shortened.</p>
          </div>
        </details>
      ))}
    </div>
  );
}

function cacheLabel(r: Receipt) {
  if (r.cache === "hit") return "cached";
  if (r.cache === "stale") return "stale copy (CMC unavailable)";
  return r.credits !== undefined ? `${r.credits} credit${r.credits === 1 ? "" : "s"}` : "live";
}
