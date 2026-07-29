"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type ShellLayoutCtx = {
  /** True dok je otvoren barem jedan sadržajni drawer (npr. aparat ili servis). */
  contentDrawerOpen: boolean;
  setContentDrawerOpen: (key: string, open: boolean) => void;
};

const NOOP_CTX: ShellLayoutCtx = {
  contentDrawerOpen: false,
  setContentDrawerOpen: () => {},
};

const Ctx = createContext<ShellLayoutCtx | null>(null);

export function ShellLayoutProvider({ children }: { children: ReactNode }) {
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  const setContentDrawerOpen = useCallback((key: string, open: boolean) => {
    setOpenKeys((prev) => {
      const has = prev.includes(key);
      if (open === has) return prev;
      return open ? [...prev, key] : prev.filter((k) => k !== key);
    });
  }, []);

  const value = useMemo<ShellLayoutCtx>(
    () => ({ contentDrawerOpen: openKeys.length > 0, setContentDrawerOpen }),
    [openKeys.length, setContentDrawerOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useShellLayout(): ShellLayoutCtx {
  return useContext(Ctx) ?? NOOP_CTX;
}

/**
 * Prijavljuje otvoreni drawer shellu (sidebar se skuplja u traku s ikonama).
 * Više drawera se broji zasebno pa zatvaranje jednog ne vraća sidebar ako je drugi još otvoren.
 */
export function useContentDrawerPresence(open: boolean): void {
  const { setContentDrawerOpen } = useShellLayout();
  const key = useId();

  useEffect(() => {
    setContentDrawerOpen(key, open);
    return () => setContentDrawerOpen(key, false);
  }, [key, open, setContentDrawerOpen]);
}
