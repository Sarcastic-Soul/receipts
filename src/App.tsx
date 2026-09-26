import { useState } from "react";
import type { CheckResult } from "../lib/types";
import { Home } from "./pages/Home";
import { ResultPage } from "./pages/ResultPage";
import { usePath } from "./router";

export default function App() {
  const path = usePath();
  // Keep the result we just made so /r/<id> doesn't fetch it again.
  const [fresh, setFresh] = useState<CheckResult | null>(null);
  const match = path.match(/^\/r\/([A-Za-z0-9]+)/);

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-3xl">
        <Header />
        {match ? (
          <ResultPage id={match[1]} initial={fresh?.id === match[1] ? fresh : null} />
        ) : (
          <Home onResult={setFresh} />
        )}
        <Footer />
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="mb-8 flex flex-col gap-0.5 border-b-2 border-ink pb-3 sm:mb-10 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <a href="/" className="font-mono text-2xl font-semibold tracking-tight">
        🧾 RECEIPTS<span className="text-bad">.</span>
      </a>
      <span className="font-mono text-xs text-muted">crypto posts, fact-checked with CoinMarketCap</span>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-14 space-y-2 border-t border-dashed border-rule pt-6 text-center font-mono text-xs leading-relaxed text-muted">
      <p>Checks facts, not whether to buy. Not financial advice.</p>
      <p>
        Market data from the{" "}
        <a className="underline" href="https://coinmarketcap.com/api/" target="_blank" rel="noreferrer">
          CoinMarketCap API
        </a>
        . Built for the DoraHacks Build with CMC hackathon.
      </p>
    </footer>
  );
}
