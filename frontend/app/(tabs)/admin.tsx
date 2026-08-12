import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import { useToast } from "@/src/components/Toast";
import { api, Product } from "@/src/api/client";
import { colors, spacing, radius, formatINR } from "@/src/theme/theme";

function formatDate(iso?: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) + " · " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function statusMeta(status: string): { label: string; color: string } {
  switch (status) {
    case "paid":
    case "captured":
      return { label: "Paid", color: colors.success };
    case "failed":
      return { label: "Failed", color: colors.error };
    default:
      return { label: "Pending", color: colors.warning };
  }
}

export default function Admin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [mode, setMode] = useState<"products" | "orders">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [prods, ords] = await Promise.all([api.listProducts(), api.listOrders()]);
      setProducts(prods);
      setOrders(ords);
    } catch {
      toast.show("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await api.deleteProduct(confirmTarget.id);
      setProducts((prev) => prev.filter((p) => p.id !== confirmTarget.id));
      toast.show("Product deleted");
    } catch {
      toast.show("Could not delete");
    } finally {
      setDeleting(false);
      setConfirmTarget(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <View>
          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.kicker}>
            ADMIN
          </AppText>
          <AppText variant="display" style={styles.headerTitle}>
            {mode === "products" ? "Products" : "Orders"}
          </AppText>
        </View>
        <AppText variant="body" color={colors.onSurfaceSecondary}>
          {mode === "products" ? `${products.length} total` : `${orders.length} total`}
        </AppText>
      </View>

      <View style={styles.segment}>
        {(["products", "orders"] as const).map((m) => {
          const active = mode === m;
          return (
            <Pressable
              key={m}
              testID={`segment-${m}`}
              onPress={() => setMode(m)}
              style={[styles.segmentBtn, active && styles.segmentBtnActive]}
            >
              <AppText
                variant="semibold"
                color={active ? colors.onBrand : colors.onSurfaceSecondary}
                style={styles.segmentText}
              >
                {m === "products" ? "Products" : "Orders"}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : mode === "products" ? (
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 140, paddingTop: spacing.sm }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="package" size={28} color={colors.muted} />
              <AppText variant="displayMedium" style={{ fontSize: 20, marginTop: spacing.md }}>
                No products yet
              </AppText>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row} testID={`admin-product-${item.id}`}>
              <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
              <View style={styles.rowBody}>
                <AppText variant="displayMedium" style={styles.name} numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.meta}>
                  {item.category} · Stock {item.stock}
                </AppText>
                <AppText variant="medium" style={styles.price}>
                  {formatINR(item.price)}
                </AppText>
              </View>
              <View style={styles.actions}>
                <Pressable
                  testID={`edit-${item.id}`}
                  onPress={() => router.push(`/admin/product-form?id=${item.id}`)}
                  style={styles.iconBtn}
                  hitSlop={6}
                >
                  <Feather name="edit-2" size={18} color={colors.onSurface} />
                </Pressable>
                <Pressable
                  testID={`delete-${item.id}`}
                  onPress={() => setConfirmTarget(item)}
                  style={styles.iconBtn}
                  hitSlop={6}
                >
                  <Feather name="trash-2" size={18} color={colors.error} />
                </Pressable>
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40, paddingTop: spacing.sm }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={
            <View style={styles.center}>
              <Feather name="inbox" size={28} color={colors.muted} />
              <AppText variant="displayMedium" style={{ fontSize: 20, marginTop: spacing.md }}>
                No orders yet
              </AppText>
              <AppText variant="body" color={colors.onSurfaceSecondary} style={{ marginTop: spacing.xs }}>
                Orders will appear here after checkout.
              </AppText>
            </View>
          }
          renderItem={({ item }) => {
            const meta = statusMeta(item.status);
            const qty = (item.items || []).reduce((s: number, i: any) => s + i.quantity, 0);
            return (
              <View style={styles.orderCard} testID={`admin-order-${item.id}`}>
                <View style={styles.orderTop}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="displayMedium" style={styles.orderName}>
                      {item.customer?.name || "Guest"}
                    </AppText>
                    <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.orderId}>
                      #{String(item.id).slice(0, 8).toUpperCase()} · {formatDate(item.created_at)}
                    </AppText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: meta.color }]}>
                    <AppText variant="semibold" color={colors.onBrand} style={styles.statusText}>
                      {meta.label}
                    </AppText>
                  </View>
                </View>

                <View style={styles.orderRow}>
                  <Feather name="phone" size={13} color={colors.muted} />
                  <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.orderMetaText}>
                    {item.customer?.phone} · {item.customer?.email}
                  </AppText>
                </View>
                <View style={styles.orderRow}>
                  <Feather name="map-pin" size={13} color={colors.muted} />
                  <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.orderMetaText}>
                    {item.customer?.address}
                  </AppText>
                </View>

                <View style={styles.orderItems}>
                  {(item.items || []).map((li: any, idx: number) => (
                    <AppText
                      key={idx}
                      variant="body"
                      color={colors.onSurfaceSecondary}
                      style={styles.lineItem}
                    >
                      {li.name} × {li.quantity}
                    </AppText>
                  ))}
                </View>

                <View style={styles.orderFooter}>
                  <AppText variant="body" color={colors.onSurfaceSecondary}>
                    {qty} {qty === 1 ? "item" : "items"}
                  </AppText>
                  <AppText variant="semibold" style={styles.orderTotal}>
                    {formatINR(item.amount)}
                  </AppText>
                </View>
              </View>
            );
          }}
        />
      )}

      {mode === "products" && (
        <View style={[styles.fabWrap, { bottom: insets.bottom + spacing.lg }]}>
          <Button
            testID="add-product-button"
            label="Add Product"
            onPress={() => router.push("/admin/product-form")}
          />
        </View>
      )}

      <Modal visible={!!confirmTarget} transparent animationType="fade" onRequestClose={() => setConfirmTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <AppText variant="displaySemiBold" style={styles.modalTitle}>
              Delete product?
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.modalText}>
              &ldquo;{confirmTarget?.name}&rdquo; will be permanently removed from your catalog.
            </AppText>
            <View style={styles.modalActions}>
              <Button
                testID="cancel-delete"
                label="Cancel"
                variant="secondary"
                onPress={() => setConfirmTarget(null)}
                style={{ flex: 1 }}
              />
              <Button
                testID="confirm-delete"
                label="Delete"
                onPress={onDelete}
                loading={deleting}
                style={{ flex: 1, backgroundColor: colors.error }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  kicker: { fontSize: 11, letterSpacing: 2 },
  headerTitle: { fontSize: 40, lineHeight: 44 },
  segment: {
    flexDirection: "row",
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill,
    padding: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  segmentBtnActive: {
    backgroundColor: colors.brand,
  },
  segmentText: { fontSize: 13, letterSpacing: 0.3 },
  orderCard: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  orderTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  orderName: { fontSize: 20, lineHeight: 24 },
  orderId: { fontSize: 12, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: { fontSize: 11, letterSpacing: 0.4 },
  orderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  orderMetaText: { flex: 1, fontSize: 13, lineHeight: 18 },
  orderItems: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  lineItem: { fontSize: 13, lineHeight: 20 },
  orderFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
  },
  orderTotal: { fontSize: 16 },
  center: {
    paddingVertical: spacing["3xl"] * 2,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.lg,
  },
  thumb: {
    width: 64,
    height: 78,
    backgroundColor: colors.surfaceSecondary,
  },
  rowBody: { flex: 1 },
  name: { fontSize: 19 },
  meta: { fontSize: 12, marginTop: 2 },
  price: { fontSize: 14, marginTop: 2 },
  actions: { flexDirection: "row", gap: spacing.xs },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginHorizontal: spacing.lg,
  },
  fabWrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(42,47,42,0.45)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: { fontSize: 24 },
  modalText: { fontSize: 14, lineHeight: 20, marginTop: spacing.sm, marginBottom: spacing.xl },
  modalActions: { flexDirection: "row", gap: spacing.md },
});
