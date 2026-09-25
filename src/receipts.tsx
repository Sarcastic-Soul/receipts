import { createContext, useContext } from "react";

// Lets any number jump to the CMC request behind it.
export const ReceiptsContext = createContext<{ open: (id: string) => void }>({ open: () => {} });

export function useReceipts() {
  return useContext(ReceiptsContext);
}
