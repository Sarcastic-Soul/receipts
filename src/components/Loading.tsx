import { useEffect, useState } from "react";

const STEPS = ["Reading the post", "Pulling out claims", "Finding coins on CoinMarketCap", "Checking every claim", "Printing receipts"];

export function Loading() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <ol className="mt-8 space-y-1 rounded-md bg-paper p-4 font-mono text-sm" aria-live="polite">
      {STEPS.map((s, i) => (
        <li key={s} className={i <= step ? "text-ink" : "text-muted/50"}>
          {i < step ? "✓" : i === step ? "›" : " "} {s}
          {i === step && <span className="animate-pulse">…</span>}
        </li>
      ))}
    </ol>
  );
}
