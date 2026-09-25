// "Coins ranked #X–Y were still in the top Y six months later Z% of the time."
// The numbers are precomputed by scripts/base-rates.ts from /v1/cryptocurrency/listings/historical
// (a Startup-plan endpoint), so the live site never needs historical calls.

import { BASE_RATES } from "./baseRatesData.js";

export function baseRateLine(rank: number | null): string | null {
  if (rank === null) return null;
  const b = BASE_RATES.buckets.find((x) => rank >= x.from && rank <= x.to);
  if (!b || b.samples < 20) return null;
  const rate = Math.round((b.stayed / b.samples) * 100);
  return `Coins ranked #${b.from}–${b.to} on CMC were still in the top ${b.to} ${BASE_RATES.months} months later ${rate}% of the time (${b.samples} past cases, last 12 months of CMC history).`;
}
