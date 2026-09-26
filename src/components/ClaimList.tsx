import type { ClaimResult } from "../../lib/types";
import { ReceiptChip } from "./ReceiptChip";
import { VerdictBadge } from "./VerdictBadge";

export function ClaimList({ claims }: { claims: ClaimResult[] }) {
  if (!claims.length) {
    return <p className="text-sm text-muted">No checkable claims in this input. The coin cards below show the live data.</p>;
  }
  return (
    <ul className="space-y-3">
      {claims.map((c) => (
        <li key={c.id} className="rounded-md border border-rule bg-white/40 p-3">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-3">
            <VerdictBadge verdict={c.verdict} />
            <div className="min-w-0 flex-1 self-stretch">
              <p className="text-sm italic text-muted">“{c.quote}”</p>
              <p className="mt-1 font-medium">{c.summary}</p>
              {c.evidence.length > 0 && (
                <dl className="mt-2 grid gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-2">
                  {c.evidence.map((e, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-1">
                      <dt className="text-muted">{e.label}:</dt>
                      <dd className="font-semibold">{e.value}</dd>
                      <ReceiptChip id={e.receiptId} />
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
