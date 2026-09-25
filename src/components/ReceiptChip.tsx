import { useReceipts } from "../receipts";

export function ReceiptChip({ id }: { id?: string }) {
  const { open } = useReceipts();
  if (!id) return null;
  return (
    <button
      onClick={() => open(id)}
      title="Show the CMC request and response behind this number"
      className="ml-1.5 rounded border border-rule px-1 font-mono text-[10px] text-muted hover:border-ink hover:text-ink"
    >
      🧾{id}
    </button>
  );
}
