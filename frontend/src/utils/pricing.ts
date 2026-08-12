import { Product } from "@/src/api/client";

export type PriceInfo = {
  unit: number; // amount actually charged per unit
  compareAt: number | null; // struck-through price (null = nothing to strike)
};

/**
 * Verified Altos ID holders see & pay the DP price (with MRP struck through).
 * Regular shoppers see & pay the admin-set offer price (with MRP struck through)
 * or plain MRP when no offer is set.
 */
export function getPriceInfo(product: Product, altosVerified: boolean): PriceInfo {
  const price = Number(product.price) || 0;
  const mrp = Number(product.mrp) || 0;
  const offer = Number(product.offer_price) || 0;

  if (altosVerified) {
    return { unit: price, compareAt: mrp > price ? mrp : null };
  }
  if (offer > 0) {
    return { unit: offer, compareAt: mrp > offer ? mrp : null };
  }
  return { unit: mrp > 0 ? mrp : price, compareAt: null };
}

export const discountPercent = (info: PriceInfo): number =>
  info.compareAt ? Math.round(((info.compareAt - info.unit) / info.compareAt) * 100) : 0;
