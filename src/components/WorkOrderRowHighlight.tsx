"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const HIGHLIGHT_MS = 2000;

type Ctx = {
  highlightItemId: string | null;
  highlightItem: (itemId: string | null) => void;
};

const NOOP_CTX: Ctx = { highlightItemId: null, highlightItem: () => {} };

const HighlightCtx = createContext<Ctx | null>(null);

/**
 * Zeleni bljesak retka nakon uspješnog spremanja u bilo kojem draweru
 * (popuni/uredi aparat, servis). Dijeljeno stanje da se retci ponašaju jednako.
 */
export function WorkOrderRowHighlightProvider({ children }: { children: ReactNode }) {
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!highlightItemId) return;
    const timer = setTimeout(() => setHighlightItemId(null), HIGHLIGHT_MS);
    return () => clearTimeout(timer);
  }, [highlightItemId]);

  const highlightItem = useCallback((itemId: string | null) => setHighlightItemId(itemId), []);

  const value = useMemo<Ctx>(
    () => ({ highlightItemId, highlightItem }),
    [highlightItemId, highlightItem],
  );

  return <HighlightCtx.Provider value={value}>{children}</HighlightCtx.Provider>;
}

export function useWorkOrderRowHighlight(): Ctx {
  return useContext(HighlightCtx) ?? NOOP_CTX;
}

export function WorkOrderItemRow({
  itemId,
  children,
}: {
  itemId: string;
  children: ReactNode;
}) {
  const { highlightItemId } = useWorkOrderRowHighlight();
  const highlighted = highlightItemId === itemId;

  return (
    <tr
      className={[
        "transition-colors duration-500",
        highlighted
          ? "bg-emerald-50 ring-2 ring-inset ring-emerald-300"
          : "hover:bg-gray-50",
      ].join(" ")}
    >
      {children}
    </tr>
  );
}
