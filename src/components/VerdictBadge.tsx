import type { Verdict } from "../../lib/types";

export const VERDICT_STYLE: Record<Verdict, { label: string; className: string }> = {
  true: { label: "TRUE", className: "bg-good text-white" },
  false: { label: "FALSE", className: "bg-bad text-white" },
  misleading: { label: "MISLEADING", className: "bg-warn text-white" },
  unverifiable: { label: "CAN'T CHECK", className: "bg-muted/20 text-muted" },
  needs_plan: { label: "NEEDS PLAN", className: "bg-info/15 text-info" },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const v = VERDICT_STYLE[verdict];
  return (
    <span className={`inline-block shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider ${v.className}`}>
      {v.label}
    </span>
  );
}
