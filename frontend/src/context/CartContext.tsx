import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { storage } from "@/src/utils/storage";
import { Product } from "@/src/api/client";
import { useAltosAuth } from "@/src/context/AltosAuthContext";
import { getPriceInfo, maxQtyFor, shippingCharge } from "@/src/utils/pricing";

export type CartLine = {
  product: Product;
  quantity: number;
};

type CartContextValue = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  shipping: number;
  total: number;
  totalWeightGrams: number;
  totalBV: number;
  ready: boolean;
  addItem: (product: Product, qty?: number) => void;
  setQuantity: (id: string, qty: number) => void;
  removeItem: (id: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = "botanica_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { verified } = useAltosAuth();
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
      const cap = maxQtyFor(product);
      const found = prev.find((l) => l.product.id === product.id);
      if (found) {
        return prev.map((l) =>
          l.product.id === product.id
            ? { ...l, quantity: Math.min(cap, l.quantity + qty) }
            : l,
        );
      }
      return [...prev, { product, quantity: Math.min(cap, qty) }];
    });
  };

  const setQuantity = (id: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product.id !== id)
        : prev.map((l) =>
            l.product.id === id ? { ...l, quantity: Math.min(maxQtyFor(l.product), qty) } : l,
          ),
    );
  };

  const removeItem = (id: string) =>
    setLines((prev) => prev.filter((l) => l.product.id !== id));

  const clear = () => setLines([]);

  const count = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);
  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + getPriceInfo(l.product, verified).unit * l.quantity, 0),
    [lines, verified],
  );
  const totalWeightGrams = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.product.weight_grams) || 0) * l.quantity, 0),
    [lines],
  );
  const totalBV = useMemo(
    () => lines.reduce((s, l) => s + (Number(l.product.bv) || 0) * l.quantity, 0),
    [lines],
  );
  const shipping = shippingCharge(totalWeightGrams);
  const total = subtotal + shipping;

  const value: CartContextValue = {
    lines,
    count,
    subtotal,
    shipping,
    total,
    totalWeightGrams,
    totalBV,
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
