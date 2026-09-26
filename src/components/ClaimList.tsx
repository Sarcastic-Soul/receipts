import type { ClaimResult } from "../../lib/types";
import { ReceiptChip } from "./ReceiptChip";
import { VERDICT_STYLE, VerdictBadge } from "./VerdictBadge";

export function ClaimList({ claims }: { claims: ClaimResult[] }) {
  if (!claims.length) {
    return <p className="text-sm text-muted">No checkable claims in this input. The coin cards below show the live data.</p>;
  }
  return (
    <ul className="space-y-3">
      {claims.map((c, i) => (
        <li
          key={c.id}
          style={{ "--i": i } as React.CSSProperties}
          className={`rise-in rounded-md border border-l-4 border-rule bg-white/50 p-3 sm:p-4 ${VERDICT_STYLE[c.verdict].border}`}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <VerdictBadge verdict={c.verdict} index={i} />
            <p className="min-w-0 flex-1 text-sm italic text-muted">“{c.quote}”</p>
          </div>
          <p className="mt-2 font-medium leading-snug">{c.summary}</p>
          {c.evidence.length > 0 && (
            <dl className="mt-3 grid gap-x-4 gap-y-1.5 border-t border-dashed border-rule pt-2 font-mono text-xs sm:grid-cols-2">
              {c.evidence.map((e, j) => (
                <div key={j} className="flex flex-wrap items-center gap-x-1">
                  <dt className="text-muted">{e.label}:</dt>
                  <dd className="font-semibold">{e.value}</dd>
                  <ReceiptChip id={e.receiptId} />
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ul>
  );
}
