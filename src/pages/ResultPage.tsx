import { ArrowLeft, Check, ChevronDown, Copy, ExternalLink, Info, Share2 } from "lucide-react";
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
        <a href="/" className="inline-flex items-center gap-1 font-mono text-sm underline">
          <ArrowLeft size={14} /> Check something else
        </a>
      </div>
    );
  }
  if (!result) return <p className="animate-pulse font-mono text-sm text-muted">Loading receipt…</p>;

  return (
    <ReceiptsContext.Provider value={{ open }}>
      <main className="space-y-6">
        <a href="/" className="inline-flex items-center gap-1 font-mono text-sm text-muted hover:text-ink">
          <ArrowLeft size={14} /> Check another post
        </a>

        <section className="print-in">
          <div className="receipt-edge-top" />
          <div className="bg-paper px-4 py-5 sm:px-8 sm:py-7">
            <SourcePost result={result} />
            <div className="my-5 dashed-rule" />
            <Tally result={result} />
            <div className="mt-5">
              <ClaimList claims={result.claims} />
            </div>
            {result.market && (
              <p className="mt-5 font-mono text-xs text-muted">
                Whole crypto market: {usd(result.market.totalMarketCap)} total cap,{" "}
                {pct(result.market.totalMarketCapChange24h)} vs yesterday.
                <ReceiptChip id={result.market.receiptId} />
              </p>
            )}
            {result.unresolved.length > 0 && (
              <p className="mt-3 rounded-md border-l-4 border-bad bg-white/50 px-3 py-2 text-sm">
                Not found on CoinMarketCap: {result.unresolved.map((u) => (u.length > 14 ? `${u.slice(0, 6)}…${u.slice(-4)}` : `$${u}`)).join(", ")}.
                A coin CMC doesn't track has no public market data to back up any claim.
              </p>
            )}
            {result.notes.length > 0 && (
              <div className="mt-4 space-y-1.5 rounded-md border border-rule bg-white/40 px-3 py-2 text-xs text-muted">
                {result.notes.map((n) => (
                  <p key={n} className="flex gap-2">
                    <Info size={14} className="mt-px shrink-0" /> <span>{n}</span>
                  </p>
                ))}
              </div>
            )}
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

        <section className="rounded-md bg-paper p-4 sm:p-5">
          <button
            onClick={() => setShowReceipts((s) => !s)}
            aria-expanded={showReceipts}
            className="flex w-full items-center justify-between gap-3 text-left font-mono text-sm font-semibold"
          >
            <span>🧾 Receipts: the CMC API calls behind every number</span>
            <ChevronDown size={18} className={`shrink-0 transition-transform ${showReceipts ? "rotate-180" : ""}`} />
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
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted">
        {input.kind === "tweet" ? "Post on X" : input.kind === "text" ? "Post" : input.kind === "ticker" ? "Ticker" : "Contract address"} ·
        checked {new Date(result.createdAt).toUTCString().replace(" GMT", " UTC")}
      </p>
      <blockquote className="whitespace-pre-wrap break-words border-l-2 border-ink/20 pl-3 text-base leading-snug sm:text-lg">{input.text}</blockquote>
      {input.tweet && (
        <p className="mt-2 font-mono text-xs text-muted">
          by{" "}
          <a href={input.tweet.authorUrl} target="_blank" rel="noreferrer" className="underline">
            {input.tweet.author}
          </a>{" "}
          ·{" "}
          <a href={input.tweet.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">
            original post <ExternalLink size={11} />
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
  const shown = (Object.keys(VERDICT_STYLE) as Verdict[]).filter((v) => counts.get(v));
  return (
    <div>
      <p className="text-xl font-bold leading-tight sm:text-2xl">
        {result.claims.length === 0
          ? "Live data below."
          : checkable === 0
            ? "Nothing here can be checked with market data."
            : `${held} of ${checkable} checkable claim${checkable === 1 ? "" : "s"} hold up.`}
      </p>
      {result.claims.length > 0 && (
        <>
          <div className="grow-x mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {shown.map((v) => (
              <div key={v} style={{ flexGrow: counts.get(v) }} className={VERDICT_STYLE[v].className} />
            ))}
          </div>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
            {shown.map((v) => (
              <span key={v} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <span className={`h-2 w-2 rounded-full ${VERDICT_STYLE[v].className}`} />
                {counts.get(v)} {VERDICT_STYLE[v].label.toLowerCase()}
              </span>
            ))}
          </p>
        </>
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
    <div className="font-mono text-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-ink px-4 py-2 font-semibold transition-colors hover:bg-ink hover:text-paper"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={intent.toString()}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-ink bg-ink px-4 py-2 font-semibold text-paper transition-transform hover:-translate-y-0.5"
        >
          <Share2 size={16} />
          {tweetId ? "Reply to the post on X" : "Share on X"}
        </a>
      </div>
      <p className="mt-3 text-xs text-muted">Facts only. Not financial advice.</p>
    </div>
  );
}
