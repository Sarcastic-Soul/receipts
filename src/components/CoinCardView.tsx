import { useState } from "react";
import { count, pct, usd } from "../../lib/format";
import type { CoinCard, RedFlag } from "../../lib/types";
import { ReceiptChip } from "./ReceiptChip";

const FLAG_STYLE: Record<RedFlag["severity"], string> = {
  high: "border-bad text-bad",
  medium: "border-warn text-warn",
  info: "border-rule text-muted",
};

export function CoinCardView({ card }: { card: CoinCard }) {
  const [showImpostors, setShowImpostors] = useState(false);
  const periods = ["1h", "24h", "7d", "30d", "90d"] as const;

  return (
    <article className="rounded-md border-2 border-ink bg-paper p-4">
      <div className="flex items-center gap-3">
        {card.logo ? (
          <img src={card.logo} alt="" className="h-10 w-10 rounded-full" loading="lazy" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-paper-dark font-mono text-xs">
            {card.symbol.slice(0, 3)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-bold">
            {card.name} <span className="font-mono text-sm text-muted">${card.symbol}</span>
          </h3>
          <p className="font-mono text-xs text-muted">
            {card.rank ? `Rank #${card.rank}` : "Unranked"}
            {card.platform && ` · ${card.platform} token`}
            {card.matchedBy === "address" && " · matched by contract address"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold">{usd(card.price)}</p>
          <p className={`font-mono text-xs ${tone(card.change["24h"])}`}>{pct(card.change["24h"])} 24h</p>
        </div>
      </div>

      <div className="my-3 dashed-rule" />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-xs sm:grid-cols-3">
        <Stat label="Market cap" value={card.marketCap ? usd(card.marketCap) : card.selfReportedMarketCap ? `${usd(card.selfReportedMarketCap)} (self-reported)` : "n/a"} />
        <Stat label="24h volume" value={usd(card.volume24h)} />
        <Stat label="Volume vs yesterday" value={pct(card.volumeChange24h, 0)} />
        <Stat label="Fully diluted" value={usd(card.fdv)} />
        <Stat label="Circulating" value={count(card.circulatingSupply)} />
        <Stat label="Max supply" value={card.maxSupply ? count(card.maxSupply) : "none"} />
        <Stat label="Market pairs" value={count(card.numMarketPairs)} />
        <Stat label="On CMC since" value={card.dateAdded?.slice(0, 10) ?? "n/a"} />
      </dl>

      <div className="mt-3 flex flex-wrap gap-2 font-mono text-xs">
        {periods.map((p) => (
          <span key={p} className="rounded bg-paper-dark px-2 py-0.5">
            {p} <span className={tone(card.change[p])}>{pct(card.change[p])}</span>
          </span>
        ))}
      </div>

      {card.redFlags.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {card.redFlags.map((f) => (
            <li key={f.id} className={`flex items-start gap-2 rounded border-l-4 bg-white/40 px-2 py-1 text-sm ${FLAG_STYLE[f.severity]}`}>
              <span aria-hidden>{f.severity === "info" ? "ℹ︎" : "⚑"}</span>
              <span className="flex-1 text-ink">{f.text}</span>
              <ReceiptChip id={f.receiptId} />
            </li>
          ))}
        </ul>
      )}

      {card.baseRate && <p className="mt-3 text-sm text-muted">📊 {card.baseRate}</p>}

      {card.impostors.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowImpostors((s) => !s)} className="font-mono text-xs underline">
            {showImpostors ? "Hide" : "Show"} the {card.impostors.length} other ${card.symbol} coin{card.impostors.length === 1 ? "" : "s"}
          </button>
          {showImpostors && (
            <ul className="mt-2 grid gap-1 font-mono text-xs sm:grid-cols-2">
              {card.impostors.map((i) => (
                <li key={i.id}>
                  <a href={`https://coinmarketcap.com/currencies/${i.slug}/`} target="_blank" rel="noreferrer" className="underline">
                    {i.name}
                  </a>{" "}
                  <span className="text-muted">{i.rank ? `#${i.rank}` : "unranked"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3 font-mono text-xs">
        <a
          href={`https://coinmarketcap.com/currencies/${card.slug}/`}
          target="_blank"
          rel="noreferrer"
          className="rounded border-2 border-ink px-2 py-1 font-semibold hover:bg-ink hover:text-paper"
        >
          Open on CMC ↗
        </a>
        {card.tags.length > 0 && <span className="text-muted">{card.tags.slice(0, 4).join(" · ")}</span>}
        <span className="ml-auto flex items-center text-muted">
          sources {card.receiptIds.map((id) => <ReceiptChip key={id} id={id} />)}
        </span>
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function tone(n: number | null) {
  if (n === null) return "text-muted";
  return n > 0 ? "text-good" : n < 0 ? "text-bad" : "text-muted";
}
