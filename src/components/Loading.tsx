import { useEffect, useState } from "react";

const STEPS = [
  ["📥", "Reading the post"],
  ["🧠", "Pulling out claims"],
  ["🔎", "Finding coins on CoinMarketCap"],
  ["⚖️", "Checking every claim"],
  ["🧾", "Printing receipts"],
] as const;

export function Loading() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1400);
    return () => clearInterval(t);
  }, []);
  return (
    <ol className="mt-8 space-y-2 rounded-md border-2 border-dashed border-rule bg-paper p-4 font-mono text-sm sm:p-5" aria-live="polite">
      {STEPS.map(([emoji, s], i) => (
        <li
          key={s}
          className={`flex items-center gap-2 transition-opacity duration-300 ${i < step ? "text-muted" : i === step ? "font-semibold text-ink" : "opacity-30"}`}
        >
          <span className="w-5 text-center" aria-hidden>
            {i < step ? "✅" : emoji}
          </span>
          {s}
          {i === step && <span className="animate-pulse">…</span>}
        </li>
      ))}
    </ol>
  );
}
