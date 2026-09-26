import { ArrowRight, Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CheckResult } from "../../lib/types";
import { checkInput } from "../api";
import { Bookmarklet } from "../components/Bookmarklet";
import { Loading } from "../components/Loading";
import { EXAMPLES } from "../examples";
import { navigate } from "../router";

export function Home({ onResult }: { onResult: (r: CheckResult) => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  async function run(value: string) {
    const text = value.trim();
    if (!text || busy) return;
    setInput(text);
    setBusy(true);
    setError(null);
    try {
      const result = await checkInput(text);
      onResult(result);
      navigate(`/r/${result.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Bookmarklet and share links open /?text=... and check right away.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const q = new URLSearchParams(window.location.search).get("text");
    if (q) {
      window.history.replaceState(null, "", "/");
      void run(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <h1 className="mb-3 text-[1.9rem] font-bold leading-[1.1] tracking-tight sm:text-5xl">
        Someone's shilling a coin.
        <br />
        Get the receipts.
      </h1>
      <p className="mb-6 text-[15px] leading-relaxed text-muted sm:text-base">
        Paste an X post link, the post's text, a <span className="font-mono">$TICKER</span> or a contract address. Every
        claim gets checked against live CoinMarketCap data, and every number shows the API call behind it.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(input);
        }}
        className="rounded-lg border-2 border-ink bg-paper p-3 shadow-[4px_4px_0_0_var(--color-ink)] transition-shadow focus-within:shadow-[6px_6px_0_0_var(--color-ink)] sm:p-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run(input);
          }}
          rows={4}
          maxLength={2000}
          placeholder={"https://x.com/someone/status/…\nor: $PEPE up 300% this week, low cap gem, listed on Binance 🚀"}
          className="w-full resize-y bg-transparent p-1 font-mono text-sm leading-relaxed outline-none placeholder:text-muted/70"
          aria-label="Post link, text, ticker or contract address"
        />
        <div className="mt-3 flex flex-col-reverse gap-2 border-t border-dashed border-rule pt-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-center font-mono text-xs text-muted sm:text-left">
            {input.length}/2000 <span className="hidden sm:inline">· Ctrl+Enter to check</span>
          </span>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-ink px-6 py-2.5 font-mono text-sm font-semibold text-paper transition hover:bg-ink/85 disabled:opacity-40"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {busy ? "Checking…" : "Check it"}
          </button>
        </div>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-md border-2 border-bad bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      {busy ? (
        <Loading />
      ) : (
        <section className="mt-10">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">Try an example</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {EXAMPLES.map((ex, i) => (
              <button
                key={ex.label}
                onClick={() => void run(ex.input)}
                style={{ "--i": i } as React.CSSProperties}
                className="rise-in group flex min-w-0 items-start gap-3 rounded-md border-2 border-rule bg-paper p-3 text-left transition hover:-translate-y-0.5 hover:border-ink"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-paper-dark text-lg" aria-hidden>
                  {ex.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs font-semibold uppercase">{ex.label}</span>
                  <span className="mt-0.5 line-clamp-2 text-sm text-muted [overflow-wrap:anywhere]">{ex.input}</span>
                </span>
                <ArrowRight size={16} className="mt-2.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
              </button>
            ))}
          </div>
        </section>
      )}

      <HowItWorks />
      <Bookmarklet />
    </main>
  );
}

function HowItWorks() {
  const steps = [
    ["Read", "Tweet links are read with X's public oEmbed. Text, tickers and addresses work directly."],
    ["Extract", "An LLM lists the coins and every checkable claim in the post. It never produces numbers."],
    ["Check", "Plain code checks each claim against CoinMarketCap: quotes, ranks, volume, supply, sector rankings and exchange wallets."],
    ["Receipts", "Every verdict links to the exact CMC request and response it came from."],
  ];
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">How it works</h2>
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map(([title, text], i) => (
          <li key={title} className="rounded-md bg-paper p-4">
            <div>
              <p>
                <span className="font-mono text-xs text-muted">0{i + 1}</span>
                <span className="ml-2 font-semibold">{title}</span>
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
