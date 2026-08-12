import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import { Product } from "@/src/api/client";

export type CartLine = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  addItem: (product: Product, qty?: number) => void;
  setQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = "botanica_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<any>(STORAGE_KEY, []);
      if (Array.isArray(saved)) setLines(saved as CartLine[]);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) storage.setItem(STORAGE_KEY, lines as any);
  }, [lines, ready]);

  const addItem = (product: Product, qty = 1) => {
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === product.id);
      if (found) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + qty } : l,
        );
      }
      return [...prev, { product, quantity: qty }];
    });
  };

  const setQuantity = (id: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product.id !== id)
        : prev.map((l) => (l.product.id === id ? { ...l, quantity: qty } : l)),
    );
  };

  const removeItem = (id: string) =>
    setLines((prev) => prev.filter((l) => l.product.id !== id));

  const clear = () => setLines([]);

  const count = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);
  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + l.product.price * l.quantity, 0),
    [lines],
  );

  const value: CartContextValue = {
    lines,
    count,
    subtotal,
    ready,
    addItem,
    setQuantity,
    removeItem,
    clear,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
