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
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api, Product, resolveImageUri } from "@/src/api/client";
import { openWhatsApp, orderConfirmationMessage, shippingUpdateMessage } from "@/src/utils/whatsapp";
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

const LOW_STOCK_THRESHOLD = 5;

function statusMeta(status: string): { label: string; color: string } {
  switch (status) {
    case "paid":
    case "captured":
      return { label: "Paid", color: colors.success };
    case "shipped":
      return { label: "Shipped", color: colors.brand };
    case "delivered":
      return { label: "Delivered", color: colors.success };
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

  const [shiprocket, setShiprocket] = useState<{ connected: boolean; email?: string }>({ connected: false });
  const [srModal, setSrModal] = useState(false);
  const [srEmail, setSrEmail] = useState("");
  const [srPassword, setSrPassword] = useState("");
  const [srConnecting, setSrConnecting] = useState(false);
  const [srSyncing, setSrSyncing] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [prods, ords, sr] = await Promise.all([
        api.listProducts(),
        api.listOrders(),
        api.shiprocketStatus().catch(() => ({ connected: false })),
      ]);
      setProducts(prods);
      setOrders(ords);
      setShiprocket(sr);
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

  const onSrConnect = async () => {
    if (!srEmail.trim() || !srPassword) return toast.show("Enter your Shiprocket API user email & password");
    setSrConnecting(true);
    try {
      await api.shiprocketConnect(srEmail.trim(), srPassword);
      setShiprocket({ connected: true, email: srEmail.trim() });
      setSrModal(false);
      setSrPassword("");
      toast.show("Shiprocket account linked");
    } catch (e: any) {
      toast.show(e?.message || "Could not link Shiprocket");
    } finally {
      setSrConnecting(false);
    }
  };

  const onSrDisconnect = async () => {
    try {
      await api.shiprocketDisconnect();
      setShiprocket({ connected: false });
      toast.show("Shiprocket account unlinked");
    } catch {
      toast.show("Could not unlink");
    }
  };

  const onSrSync = async () => {
    setSrSyncing(true);
    try {
      const res = await api.shiprocketSync();
      if (res.updated.length > 0) {
        toast.show(`${res.updated.length} order(s) updated from Shiprocket`);
        await load();
      } else {
        toast.show("No shipping updates found in Shiprocket");
      }
    } catch (e: any) {
      toast.show(e?.message || "Sync failed");
    } finally {
      setSrSyncing(false);
    }
  };

  const onSetStatus = async (order: any, status: string) => {
    setStatusUpdating(order.id);
    try {
      const updated = await api.updateOrderStatus(order.id, { status });
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      toast.show(`Order marked ${status}`);
      if (status === "shipped") {
        openWhatsApp(shippingUpdateMessage(updated), updated.customer?.phone);
      }
    } catch {
      toast.show("Could not update status");
    } finally {
      setStatusUpdating(null);
    }
  };

  const onWhatsApp = (order: any) => {
    const shippedLike = order.status === "shipped" || order.status === "delivered";
    const text = shippedLike ? shippingUpdateMessage(order) : orderConfirmationMessage(order);
    openWhatsApp(text, order.customer?.phone);
  };

  const ShiprocketCard = (
    <View style={styles.srCard} testID="shiprocket-card">
      <View style={styles.srTop}>
        <View style={styles.srIconWrap}>
          <Feather name="truck" size={18} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="semibold" style={styles.srTitle}>
            Shiprocket
          </AppText>
          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.srSub}>
            {shiprocket.connected
              ? `Linked · ${shiprocket.email}`
              : "Link your account to sync shipping status"}
          </AppText>
        </View>
        {shiprocket.connected ? (
          <Pressable testID="shiprocket-unlink" onPress={onSrDisconnect} hitSlop={8}>
            <AppText variant="semibold" color={colors.error} style={styles.srAction}>
              Unlink
            </AppText>
          </Pressable>
        ) : (
          <Pressable testID="shiprocket-link" onPress={() => setSrModal(true)} hitSlop={8} style={styles.srLinkBtn}>
            <AppText variant="semibold" color={colors.onBrand} style={styles.srAction}>
              Link
            </AppText>
          </Pressable>
        )}
      </View>
      {shiprocket.connected && (
        <>
          <Button
            testID="shiprocket-sync"
            label={srSyncing ? "Syncing…" : "Sync shipping status"}
            variant="secondary"
            onPress={onSrSync}
            loading={srSyncing}
            style={styles.srSyncBtn}
          />
          <AppText variant="body" color={colors.muted} style={styles.srHint}>
            When creating a shipment in Shiprocket, use the order code (e.g. #1A2B3C4D) as the
            Order ID. Sync marks matching orders Shipped/Delivered and opens WhatsApp so you can
            send tracking to the customer.
          </AppText>
        </>
      )}
    </View>
  );

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
          ListHeaderComponent={
            <>
              <Pressable
                testID="manage-banners"
                onPress={() => router.push("/admin/banners")}
                style={styles.manageDiseases}
              >
                <Feather name="image" size={16} color={colors.brand} />
                <AppText variant="semibold" style={styles.manageDiseasesText}>
                  Home Banners — upload & manage (max 4)
                </AppText>
                <Feather name="chevron-right" size={16} color={colors.muted} />
              </Pressable>
              <Pressable
                testID="manage-certificates"
                onPress={() => router.push("/admin/certificates")}
                style={styles.manageDiseases}
              >
                <Feather name="award" size={16} color={colors.brand} />
                <AppText variant="semibold" style={styles.manageDiseasesText}>
                  Certificates — upload for About Us page
                </AppText>
                <Feather name="chevron-right" size={16} color={colors.muted} />
              </Pressable>
              <Pressable
                testID="manage-diseases"
                onPress={() => router.push("/admin/diseases")}
                style={styles.manageDiseases}
              >
                <Feather name="heart" size={16} color={colors.brand} />
                <AppText variant="semibold" style={styles.manageDiseasesText}>
                  Shop by Disease — manage concerns & products
                </AppText>
                <Feather name="chevron-right" size={16} color={colors.muted} />
              </Pressable>
              {products.some((p) => p.stock <= LOW_STOCK_THRESHOLD) ? (
                <View style={styles.lowStockBanner} testID="low-stock-banner">
                  <Feather name="alert-triangle" size={16} color="#B45309" />
                  <AppText variant="semibold" style={styles.lowStockBannerText}>
                    {products.filter((p) => p.stock <= LOW_STOCK_THRESHOLD).length} product(s) low on
                    stock (≤ {LOW_STOCK_THRESHOLD} left)
                  </AppText>
                </View>
              ) : null}
            </>
          }
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
              <Image source={{ uri: resolveImageUri(item.image) }} style={styles.thumb} contentFit="cover" />
              <View style={styles.rowBody}>
                <AppText variant="displayMedium" style={styles.name} numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.meta}>
                  {item.category}
                  {item.weight ? ` · ${item.weight}` : ""} · Stock {item.stock}
                </AppText>
                {item.stock <= LOW_STOCK_THRESHOLD && (
                  <View style={styles.lowStockPill} testID={`low-stock-${item.id}`}>
                    <Feather name="alert-triangle" size={10} color="#B45309" />
                    <AppText variant="semibold" style={styles.lowStockPillText}>
                      {item.stock === 0 ? "Out of stock" : `Low stock: ${item.stock} left`}
                    </AppText>
                  </View>
                )}
                <View style={styles.adminPriceRow}>
                  <AppText variant="medium" style={styles.price}>
                    {formatINR(item.price)}
                  </AppText>
                  {item.mrp > item.price && (
                    <AppText variant="body" color={colors.muted} style={styles.adminMrp}>
                      {formatINR(item.mrp)}
                    </AppText>
                  )}
                </View>
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
          ListHeaderComponent={ShiprocketCard}
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

                {(item.awb || item.courier_name) && (
                  <View style={styles.orderRow}>
                    <Feather name="truck" size={13} color={colors.muted} />
                    <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.orderMetaText}>
                      {[item.courier_name, item.awb ? `AWB ${item.awb}` : ""].filter(Boolean).join(" · ")}
                    </AppText>
                  </View>
                )}

                <View style={styles.orderActions}>
                  <Pressable
                    testID={`whatsapp-${item.id}`}
                    onPress={() => onWhatsApp(item)}
                    style={styles.waBtn}
                  >
                    <Feather name="message-circle" size={15} color={colors.onBrand} />
                    <AppText variant="semibold" color={colors.onBrand} style={styles.actionText}>
                      {item.status === "shipped" || item.status === "delivered"
                        ? "Send tracking"
                        : "Confirm order"}
                    </AppText>
                  </Pressable>
                  {item.status === "paid" && (
                    <Pressable
                      testID={`mark-shipped-${item.id}`}
                      onPress={() => onSetStatus(item, "shipped")}
                      style={styles.statusBtn}
                      disabled={statusUpdating === item.id}
                    >
                      <AppText variant="semibold" color={colors.onSurface} style={styles.actionText}>
                        {statusUpdating === item.id ? "Updating…" : "Mark Shipped"}
                      </AppText>
                    </Pressable>
                  )}
                  {item.status === "shipped" && (
                    <Pressable
                      testID={`mark-delivered-${item.id}`}
                      onPress={() => onSetStatus(item, "delivered")}
                      style={styles.statusBtn}
                      disabled={statusUpdating === item.id}
                    >
                      <AppText variant="semibold" color={colors.onSurface} style={styles.actionText}>
                        {statusUpdating === item.id ? "Updating…" : "Mark Delivered"}
                      </AppText>
                    </Pressable>
                  )}
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

      <Modal visible={srModal} transparent animationType="fade" onRequestClose={() => setSrModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <AppText variant="displaySemiBold" style={styles.modalTitle}>
              Link Shiprocket
            </AppText>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.modalText}>
              Enter your Shiprocket API user credentials (Shiprocket Panel → Settings → API →
              Configure). This is separate from your main Shiprocket login.
            </AppText>
            <FormField
              testID="sr-email"
              label="API user email"
              value={srEmail}
              onChangeText={setSrEmail}
              placeholder="api-user@yourstore.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <FormField
              testID="sr-password"
              label="API user password"
              value={srPassword}
              onChangeText={setSrPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
            />
            <View style={styles.modalActions}>
              <Button
                testID="sr-cancel"
                label="Cancel"
                variant="secondary"
                onPress={() => setSrModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                testID="sr-connect"
                label="Link account"
                onPress={onSrConnect}
                loading={srConnecting}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

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
  orderActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  waBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: "#25D366",
  },
  statusBtn: {
    height: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 13, letterSpacing: 0.2 },
  srCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  srTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  srIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  srTitle: { fontSize: 15 },
  srSub: { fontSize: 12, marginTop: 2 },
  srAction: { fontSize: 13 },
  srLinkBtn: {
    height: 40,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  srSyncBtn: {
    marginTop: spacing.lg,
    height: 44,
  },
  srHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.md,
  },
  lowStockBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "#F0C36D",
    backgroundColor: "#FDF3E0",
  },
  lowStockBannerText: { fontSize: 12, color: "#B45309", flex: 1 },
  lowStockPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "#FDF3E0",
  },
  lowStockPillText: { fontSize: 10, color: "#B45309", letterSpacing: 0.2 },
  manageDiseases: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  manageDiseasesText: { fontSize: 12, flex: 1 },
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
  adminPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  adminMrp: {
    fontSize: 12,
    textDecorationLine: "line-through",
  },
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
