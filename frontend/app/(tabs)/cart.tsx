import React from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import QuantityStepper from "@/src/components/QuantityStepper";
import { useCart } from "@/src/context/CartContext";
import { useAltosAuth } from "@/src/context/AltosAuthContext";
import { resolveImageUri } from "@/src/api/client";
import { getPriceInfo, maxQtyFor, isHeavyItem, formatWeight } from "@/src/utils/pricing";
import { colors, spacing, formatINR } from "@/src/theme/theme";

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { lines, subtotal, shipping, total, totalWeightGrams, totalBV, setQuantity, removeItem, count } =
    useCart();
  const { verified } = useAltosAuth();

  if (lines.length === 0) {
    return (
      <View style={[styles.container, styles.emptyWrap]}>
        <View style={styles.emptyIcon}>
          <Feather name="shopping-bag" size={30} color={colors.brand} />
        </View>
        <AppText variant="display" style={styles.emptyTitle}>
          Your cart is empty
        </AppText>
        <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.emptySub}>
          Discover our botanical supplements and skincare.
        </AppText>
        <Button
          testID="browse-products-button"
          label="Browse Products"
          variant="secondary"
          onPress={() => router.push("/")}
          style={{ marginTop: spacing.xl, minWidth: 220 }}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <AppText variant="display" style={styles.headerTitle}>
          Cart
        </AppText>
        <AppText variant="body" color={colors.onSurfaceSecondary}>
          {count} {count === 1 ? "item" : "items"}
        </AppText>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 200 }}
      >
        {lines.map((line, index) => (
          <View key={line.product.id}>
            <View style={styles.item} testID={`cart-item-${line.product.id}`}>
              <Image source={{ uri: resolveImageUri(line.product.image) }} style={styles.thumb} contentFit="cover" />
              <View style={styles.itemBody}>
                <AppText variant="displayMedium" style={styles.itemName} numberOfLines={2}>
                  {line.product.name}
                </AppText>
                {!!line.product.weight && (
                  <AppText variant="body" color={colors.muted} style={styles.itemPacking}>
                    {line.product.weight}
                  </AppText>
                )}
                <AppText variant="medium" style={styles.itemPrice}>
                  {formatINR(getPriceInfo(line.product, verified).unit)}
                </AppText>
                <View style={styles.itemControls}>
                  <QuantityStepper
                    value={line.quantity}
                    onChange={(v) => setQuantity(line.product.id, v)}
                    max={maxQtyFor(line.product)}
                    testIDPrefix={`cart-qty-${line.product.id}`}
                  />
                  <Pressable
                    testID={`remove-${line.product.id}`}
                    onPress={() => removeItem(line.product.id)}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={18} color={colors.muted} />
                  </Pressable>
                </View>
                {isHeavyItem(line.product) && (
                  <AppText variant="body" color={colors.warning} style={styles.limitNote}>
                    Max 2 pcs per order (500g+ item)
                  </AppText>
                )}
              </View>
            </View>
            {index < lines.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.summaryRow}>
          <AppText variant="body" color={colors.onSurfaceSecondary}>
            Subtotal
          </AppText>
          <AppText variant="medium">{formatINR(subtotal)}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText variant="body" color={colors.onSurfaceSecondary}>
            Shipping{totalWeightGrams > 0 ? ` (${formatWeight(totalWeightGrams)})` : ""}
          </AppText>
          {shipping > 0 ? (
            <AppText variant="medium" testID="shipping-amount">
              {formatINR(shipping)}
            </AppText>
          ) : (
            <AppText variant="medium" color={colors.success} testID="shipping-amount">
              Free
            </AppText>
          )}
        </View>
        {verified && totalBV > 0 && (
          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.onSurfaceSecondary}>
              Total BV
            </AppText>
            <AppText variant="semibold" color={colors.brand} testID="cart-total-bv">
              {totalBV} BV
            </AppText>
          </View>
        )}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <AppText variant="displaySemiBold" style={styles.totalLabel}>
            Total
          </AppText>
          <AppText variant="displaySemiBold" style={styles.totalLabel}>
            {formatINR(total)}
          </AppText>
        </View>
        <Button
          testID="checkout-button"
          label="Proceed to Checkout"
          onPress={() => router.push("/checkout")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontSize: 40, lineHeight: 44 },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  emptyTitle: { fontSize: 32 },
  emptySub: { fontSize: 14, textAlign: "center", marginTop: spacing.sm },
  item: {
    flexDirection: "row",
    padding: spacing.lg,
    gap: spacing.lg,
  },
  thumb: {
    width: 90,
    height: 110,
    backgroundColor: colors.surfaceSecondary,
  },
  itemBody: { flex: 1 },
  itemName: { fontSize: 20, lineHeight: 24 },
  itemPacking: { fontSize: 12, marginTop: 2 },
  itemPrice: { fontSize: 14, marginTop: spacing.xs },
  itemControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  limitNote: {
    fontSize: 11,
    marginTop: spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.lg,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  totalRow: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  totalLabel: { fontSize: 24 },
});
