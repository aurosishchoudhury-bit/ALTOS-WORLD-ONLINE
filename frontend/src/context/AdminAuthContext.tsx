import React, { createContext, useContext, useMemo, useState, useCallback } from "react";

import { api } from "@/src/api/client";

type AdminAuthValue = {
  unlocked: boolean;
  sessionToken: string | null;
  unlock: (pin: string) => Promise<void>;
  lock: () => void;
};

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: React.PropsWithChildren) {
  // In-memory only: closing/reloading the app locks the admin panel again.
  const [sessionToken, setSessionToken] = useState<string | null>(null);

  const unlock = useCallback(async (pin: string) => {
    const res = await api.verifyAdminPin(pin);
    setSessionToken(res.session_token);
  }, []);

  const lock = useCallback(() => setSessionToken(null), []);

  const value = useMemo(
    () => ({ unlocked: !!sessionToken, sessionToken, unlock, lock }),
    [sessionToken, unlock, lock],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
}
