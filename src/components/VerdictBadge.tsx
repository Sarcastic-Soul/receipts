import type { Verdict } from "../../lib/types";

export const VERDICT_STYLE: Record<Verdict, { label: string; className: string; border: string }> = {
  true: { label: "TRUE", className: "bg-good text-white", border: "border-l-good" },
  false: { label: "FALSE", className: "bg-bad text-white", border: "border-l-bad" },
  misleading: { label: "MISLEADING", className: "bg-warn text-white", border: "border-l-warn" },
  unverifiable: { label: "CAN'T CHECK", className: "bg-muted/20 text-muted", border: "border-l-rule" },
  needs_plan: { label: "NEEDS PLAN", className: "bg-info/15 text-info", border: "border-l-info" },
};

export function VerdictBadge({ verdict, index = 0 }: { verdict: Verdict; index?: number }) {
  const v = VERDICT_STYLE[verdict];
  return (
    <span
      style={{ "--i": index } as React.CSSProperties}
      className={`stamp inline-block shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider ${v.className}`}
    >
      {v.label}
    </span>
  );
}
