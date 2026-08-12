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

export default function Admin() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTarget, setConfirmTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const prods = await api.listProducts();
      setProducts(prods);
    } catch {
      toast.show("Failed to load products");
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
            Products
          </AppText>
        </View>
        <AppText variant="body" color={colors.onSurfaceSecondary}>
          {products.length} total
        </AppText>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
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
      )}

      <View style={[styles.fabWrap, { bottom: insets.bottom + spacing.lg }]}>
        <Button
          testID="add-product-button"
          label="Add Product"
          onPress={() => router.push("/admin/product-form")}
        />
      </View>

      <Modal visible={!!confirmTarget} transparent animationType="fade" onRequestClose={() => setConfirmTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <AppText variant="displaySemiBold" style={styles.modalTitle}>
              Delete product?
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.modalText}>
              "{confirmTarget?.name}" will be permanently removed from your catalog.
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
