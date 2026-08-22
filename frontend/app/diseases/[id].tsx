import React, { useEffect, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import ProductCard from "@/src/components/ProductCard";
import { useCart } from "@/src/context/CartContext";
import { useAltosAuth } from "@/src/context/AltosAuthContext";
import { useToast } from "@/src/components/Toast";
import { api, Product } from "@/src/api/client";
import { getPriceInfo } from "@/src/utils/pricing";
import { colors, spacing, formatINR } from "@/src/theme/theme";

export default function DiseaseProducts() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const { verified } = useAltosAuth();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [dosages, setDosages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([api.getDiseaseProducts(id), api.getDisease(id).catch(() => null)])
      .then(([prods, disease]) => {
        setProducts(prods);
        setDosages(disease?.dosages || {});
      })
      .catch(() => toast.show("Could not load products"))
      .finally(() => setLoading(false));
  }, [id, toast]);

  const inStock = products.filter((p) => (p.stock ?? 1) > 0);
  const packageTotal = inStock.reduce((s, p) => s + getPriceInfo(p, verified).unit, 0);

  const addPackage = () => {
    inStock.forEach((p) => addItem(p, 1));
    toast.show(`Complete package (${inStock.length} products) added to cart`);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="disease-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title} numberOfLines={1}>
          {name || "Products"}
        </AppText>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : products.length === 0 ? (
        <View style={styles.center}>
          <Feather name="package" size={28} color={colors.muted} />
          <AppText variant="body" color={colors.muted} style={styles.emptyText}>
            No products mapped to this concern yet.
          </AppText>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrap}
          contentContainerStyle={{ paddingBottom: spacing.xxl, paddingTop: spacing.lg }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.dosageTable} testID="dosage-table">
              <AppText variant="semibold" style={styles.dosageTitle}>
                Recommended Dosage
              </AppText>
              <View style={styles.tableHeader}>
                <AppText variant="semibold" style={[styles.cell, styles.cellHead]}>
                  Product
                </AppText>
                <AppText variant="semibold" style={[styles.cell, styles.cellHead]}>
                  Dosage
                </AppText>
              </View>
              {products.map((p) => (
                <View key={`row-${p.id}`} style={styles.tableRow}>
                  <AppText variant="body" style={styles.cell} numberOfLines={2}>
                    {p.name}
                  </AppText>
                  <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.cell}>
                    {dosages[p.id] || p.dosage || "As directed"}
                  </AppText>
                </View>
              ))}
            </View>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => router.push(`/product/${item.id}`)}
              onAdd={() => {
                addItem(item, 1);
                toast.show("Added to cart");
              }}
            />
          )}
        />
      )}

      {!loading && inStock.length > 0 && (
        <View style={[styles.packageBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={{ flex: 1 }}>
            <AppText variant="semibold" style={styles.packageTitle}>
              Complete package · {inStock.length} {inStock.length === 1 ? "product" : "products"}
            </AppText>
            <AppText variant="displaySemiBold" style={styles.packageAmount} testID="package-total">
              {formatINR(packageTotal)}
            </AppText>
          </View>
          <Pressable testID="add-package-button" onPress={addPackage} style={styles.packageBtn}>
            <Feather name="shopping-cart" size={16} color={colors.onBrand} />
            <AppText variant="semibold" color={colors.onBrand} style={styles.packageBtnText}>
              Add All to Cart
            </AppText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, flex: 1, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  emptyText: { fontSize: 13 },
  columnWrap: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dosageTable: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    overflow: "hidden",
  },
  dosageTitle: {
    fontSize: 15,
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  cell: {
    flex: 1,
    fontSize: 13,
    padding: spacing.md,
  },
  cellHead: { fontSize: 12 },
  packageBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  packageTitle: { fontSize: 12, color: colors.onSurfaceSecondary },
  packageAmount: { fontSize: 20, marginTop: 2 },
  packageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
  },
  packageBtnText: { fontSize: 14 },
});
