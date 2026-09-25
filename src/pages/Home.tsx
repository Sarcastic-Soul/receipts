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
      <h1 className="mb-3 text-3xl font-bold leading-tight sm:text-4xl">
        Someone's shilling a coin.
        <br />
        Get the receipts.
      </h1>
      <p className="mb-6 text-muted">
        Paste an X post link, the post's text, a <span className="font-mono">$TICKER</span> or a contract address. Every
        claim gets checked against live CoinMarketCap data, and every number shows the API call behind it.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void run(input);
        }}
        className="rounded-lg border-2 border-ink bg-paper p-3 shadow-[4px_4px_0_0_var(--color-ink)]"
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
          className="w-full resize-y bg-transparent font-mono text-sm outline-none placeholder:text-muted/70"
          aria-label="Post link, text, ticker or contract address"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-muted">{input.length}/2000</span>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-md bg-ink px-5 py-2 font-mono text-sm font-semibold text-paper transition hover:bg-ink/85 disabled:opacity-40"
          >
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
        <section className="mt-8">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">Try an example</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                onClick={() => void run(ex.input)}
                className="rounded-md border-2 border-rule bg-paper p-3 text-left transition hover:border-ink"
              >
                <span className="block font-mono text-xs font-semibold uppercase">{ex.label}</span>
                <span className="mt-1 line-clamp-2 block text-sm text-muted">{ex.input}</span>
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
    ["Check", "Plain code checks each claim against CoinMarketCap: quotes, ranks, volume, market pairs, supply."],
    ["Receipts", "Every verdict links to the exact CMC request and response it came from."],
  ];
  return (
    <section className="mt-10">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">How it works</h2>
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map(([title, text], i) => (
          <li key={title} className="rounded-md bg-paper p-3">
            <span className="font-mono text-xs text-muted">0{i + 1}</span>
            <span className="ml-2 font-semibold">{title}</span>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
