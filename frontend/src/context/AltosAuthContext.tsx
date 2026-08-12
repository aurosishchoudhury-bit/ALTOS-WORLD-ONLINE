import React, { createContext, useContext, useState } from "react";

type AltosAuth = {
  verified: boolean;
  setVerified: (v: boolean) => void;
};

const Ctx = createContext<AltosAuth>({ verified: false, setVerified: () => {} });

export function AltosAuthProvider({ children }: { children: React.ReactNode }) {
  const [verified, setVerified] = useState(false);
  return <Ctx.Provider value={{ verified, setVerified }}>{children}</Ctx.Provider>;
}

export const useAltosAuth = () => useContext(Ctx);
