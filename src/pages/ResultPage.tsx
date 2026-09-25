import { useCallback, useEffect, useState } from "react";
import { pct, usd } from "../../lib/format";
import type { CheckResult, Verdict } from "../../lib/types";
import { getResult } from "../api";
import { ClaimList } from "../components/ClaimList";
import { CoinCardView } from "../components/CoinCardView";
import { ReceiptChip } from "../components/ReceiptChip";
import { ReceiptsPanel } from "../components/ReceiptsPanel";
import { VERDICT_STYLE } from "../components/VerdictBadge";
import { ReceiptsContext } from "../receipts";

export function ResultPage({ id, initial }: { id: string; initial: CheckResult | null }) {
  const [result, setResult] = useState<CheckResult | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [showReceipts, setShowReceipts] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  useEffect(() => {
    if (initial?.id === id) return;
    setResult(null);
    getResult(id).then(setResult, (e: Error) => setError(e.message));
  }, [id, initial]);

  const open = useCallback((receiptId: string) => {
    setShowReceipts(true);
    setHighlight(receiptId);
    requestAnimationFrame(() =>
      document.getElementById(`receipt-${receiptId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }, []);

  if (error) {
    return (
      <div className="rounded-md bg-paper p-6">
        <p className="mb-3 text-bad">{error}</p>
        <a href="/" className="font-mono text-sm underline">
          ← Check something else
        </a>
      </div>
    );
  }
  if (!result) return <p className="font-mono text-sm text-muted">Loading receipt…</p>;

  return (
    <ReceiptsContext.Provider value={{ open }}>
      <main className="space-y-6">
        <a href="/" className="font-mono text-sm underline">
          ← Check another post
        </a>

        <section>
          <div className="receipt-edge-top" />
          <div className="bg-paper px-5 py-5 sm:px-7">
            <SourcePost result={result} />
            <div className="my-5 dashed-rule" />
            <Tally result={result} />
            <div className="mt-4">
              <ClaimList claims={result.claims} />
            </div>
            {result.market && (
              <p className="mt-4 font-mono text-xs text-muted">
                Whole crypto market: {usd(result.market.totalMarketCap)} total cap,{" "}
                {pct(result.market.totalMarketCapChange24h)} vs yesterday.
                <ReceiptChip id={result.market.receiptId} />
              </p>
            )}
            {result.unresolved.length > 0 && (
              <p className="mt-3 rounded border-l-4 border-bad bg-white/40 px-2 py-1 text-sm">
                Not found on CoinMarketCap: {result.unresolved.map((u) => (u.length > 14 ? `${u.slice(0, 6)}…${u.slice(-4)}` : `$${u}`)).join(", ")}.
                A coin CMC doesn't track has no public market data to back up any claim.
              </p>
            )}
            {result.notes.map((n) => (
              <p key={n} className="mt-2 font-mono text-xs text-muted">
                Note: {n}
              </p>
            ))}
            <div className="my-5 dashed-rule" />
            <Share result={result} />
          </div>
          <div className="receipt-edge" />
        </section>

        <section className="space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-muted">Coin{result.coins.length === 1 ? "" : "s"}</h2>
          {result.coins.map((c) => (
            <CoinCardView key={c.id} card={c} />
          ))}
        </section>

        <section className="rounded-md bg-paper p-4">
          <button onClick={() => setShowReceipts((s) => !s)} className="flex w-full items-center justify-between font-mono text-sm font-semibold">
            <span>🧾 Receipts: the CMC API calls behind every number</span>
            <span>{showReceipts ? "Hide" : "Show"}</span>
          </button>
          {showReceipts && (
            <div className="mt-4">
              <ReceiptsPanel receipts={result.receipts} highlight={highlight} />
            </div>
          )}
        </section>
      </main>
    </ReceiptsContext.Provider>
  );
}

function SourcePost({ result }: { result: CheckResult }) {
  const { input } = result;
  return (
    <div>
      <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
        {input.kind === "tweet" ? "Post on X" : input.kind === "text" ? "Post" : input.kind === "ticker" ? "Ticker" : "Contract address"} ·
        checked {new Date(result.createdAt).toUTCString().replace(" GMT", " UTC")}
      </p>
      <blockquote className="whitespace-pre-wrap break-words text-lg leading-snug">{input.text}</blockquote>
      {input.tweet && (
        <p className="mt-2 font-mono text-xs text-muted">
          by{" "}
          <a href={input.tweet.authorUrl} target="_blank" rel="noreferrer" className="underline">
            {input.tweet.author}
          </a>{" "}
          ·{" "}
          <a href={input.tweet.url} target="_blank" rel="noreferrer" className="underline">
            original post ↗
          </a>
        </p>
      )}
    </div>
  );
}

function Tally({ result }: { result: CheckResult }) {
  const counts = new Map<Verdict, number>();
  for (const c of result.claims) counts.set(c.verdict, (counts.get(c.verdict) ?? 0) + 1);
  const checkable = result.claims.filter((c) => c.verdict !== "unverifiable" && c.verdict !== "needs_plan").length;
  const held = counts.get("true") ?? 0;
  return (
    <div>
      <p className="text-2xl font-bold">
        {result.claims.length === 0
          ? "Live data below."
          : checkable === 0
            ? "Nothing here can be checked with market data."
            : `${held} of ${checkable} checkable claim${checkable === 1 ? "" : "s"} hold up.`}
      </p>
      {result.claims.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-2 font-mono text-xs">
          {(Object.keys(VERDICT_STYLE) as Verdict[])
            .filter((v) => counts.get(v))
            .map((v) => (
              <span key={v} className={`rounded px-1.5 ${VERDICT_STYLE[v].className}`}>
                {counts.get(v)} {VERDICT_STYLE[v].label.toLowerCase()}
              </span>
            ))}
        </p>
      )}
    </div>
  );
}

function Share({ result }: { result: CheckResult }) {
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/r/${result.id}`;
  const falseCount = result.claims.filter((c) => c.verdict === "false" || c.verdict === "misleading").length;
  const coin = result.coins[0] ? `$${result.coins[0].symbol}` : "this";
  const text =
    result.claims.length > 0
      ? `Checked ${coin} claims against CoinMarketCap data: ${falseCount} of ${result.claims.length} don't hold up. Receipts:`
      : `${coin} on CoinMarketCap, with receipts:`;
  const tweetId = result.input.tweet?.url.match(/status\/(\d+)/)?.[1];
  const intent = new URL("https://x.com/intent/tweet");
  intent.searchParams.set("text", text);
  intent.searchParams.set("url", url);
  if (tweetId) intent.searchParams.set("in_reply_to", tweetId);

  return (
    <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
      <button
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="rounded-md border-2 border-ink px-3 py-1.5 font-semibold hover:bg-ink hover:text-paper"
      >
        {copied ? "Copied ✓" : "Copy link"}
      </button>
      <a href={intent.toString()} target="_blank" rel="noreferrer" className="rounded-md bg-ink px-3 py-1.5 font-semibold text-paper">
        {tweetId ? "Reply to the post on X" : "Share on X"}
      </a>
      <span className="text-xs text-muted">Facts only. Not financial advice.</span>
    </div>
  );
}
