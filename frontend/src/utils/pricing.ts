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

/** Total amount saved vs MRP across cart lines (0 when nothing is discounted). */
export function cartSavings(
  lines: { product: Product; quantity: number }[],
  altosVerified: boolean
): number {
  return lines.reduce((sum, l) => {
    const info = getPriceInfo(l.product, altosVerified);
    return sum + (info.compareAt ? (info.compareAt - info.unit) * l.quantity : 0);
  }, 0);
}

// ---- Minimum purchase (cart subtotal) ----
export const MIN_PURCHASE_ALTOS = 599; // verified Altos ID holders
export const MIN_PURCHASE_REGULAR = 399; // non-Altos customers

export const minPurchaseFor = (altosVerified: boolean): number =>
  altosVerified ? MIN_PURCHASE_ALTOS : MIN_PURCHASE_REGULAR;

// ---- Weight-based shipping & limits ----
export const HEAVY_ITEM_THRESHOLD_G = 500; // items >= 500g are limited per order
export const HEAVY_ITEM_MAX_QTY = 2;

export const isHeavyItem = (p: Product): boolean =>
  (Number(p.weight_grams) || 0) >= HEAVY_ITEM_THRESHOLD_G;

export const maxQtyFor = (p: Product): number => (isHeavyItem(p) ? HEAVY_ITEM_MAX_QTY : 99);

/** Free up to 3kg; Rs.50 above 3kg up to 5kg; Rs.100 above 5kg. */
export function shippingCharge(totalGrams: number): number {
  if (totalGrams > 5000) return 100;
  if (totalGrams > 3000) return 50;
  return 0;
}

export const formatWeight = (grams: number): string =>
  grams >= 1000 ? `${(grams / 1000).toFixed(grams % 1000 === 0 ? 0 : 1)} kg` : `${Math.round(grams)} g`;
