import React, { useState } from "react";
import { View, StyleSheet, Pressable, FlatList, Linking, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { colors, spacing, radius, formatINR } from "@/src/theme/theme";

const STATUS_LABEL: Record<string, string> = {
  paid: "Confirmed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  paid: "#3E8E4C",
  shipped: "#E8963E",
  delivered: "#2E9E5B",
  cancelled: "#D9534F",
};

const orderCode = (id: string) => id.slice(0, 8).toUpperCase();

export default function OrderLookup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (phone.trim().length < 10) {
      toast.show("Enter your 10-digit mobile number");
      return;
    }
    setLoading(true);
    try {
      const res = await api.lookupOrders(phone.trim());
      setOrders(res);
    } catch (e: any) {
      toast.show(e?.message || "Could not fetch orders");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (o: any) => {
    try {
      await api.cancelOrder(o.id, phone.trim());
      setOrders((prev) =>
        (prev || []).map((x) => (x.id === o.id ? { ...x, status: "cancelled" } : x)),
      );
      toast.show("Order cancelled. Any payment will be refunded by the store.");
    } catch (e: any) {
      toast.show(e?.message || "Could not cancel order");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="orders-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Track My Orders
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAwareScrollView bottomOffset={20} contentContainerStyle={styles.scroll}>
        <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.intro}>
          Enter the mobile number you used at checkout to see your orders and tracking.
        </AppText>
        <FormField
          testID="lookup-phone"
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="10-digit mobile"
        />
        <Button testID="lookup-button" label="Find my orders" onPress={search} loading={loading} />

        {loading && <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />}

        {orders !== null && !loading && (
          <FlatList
            data={orders}
            keyExtractor={(o) => o.id}
            scrollEnabled={false}
            contentContainerStyle={{ marginTop: spacing.xl }}
            ListEmptyComponent={
              <AppText variant="body" color={colors.muted} style={styles.empty}>
                No orders found for this number.
              </AppText>
            }
            renderItem={({ item }) => (
              <View style={styles.card} testID={`order-${item.id}`}>
                <View style={styles.cardTop}>
                  <AppText variant="semibold" style={styles.code}>
                    #{orderCode(item.id)}
                  </AppText>
                  <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] || colors.muted) + "22" }]}>
                    <AppText variant="semibold" style={[styles.badgeText, { color: STATUS_COLOR[item.status] || colors.muted }]}>
                      {STATUS_LABEL[item.status] || item.status}
                    </AppText>
                  </View>
                </View>
                <AppText variant="body" color={colors.muted} style={styles.date}>
                  {(item.created_at || "").slice(0, 10)}
                </AppText>
                {item.items.map((it: any, idx: number) => (
                  <AppText key={idx} variant="body" color={colors.onSurfaceSecondary} style={styles.itemLine}>
                    {it.quantity} × {it.name}
                  </AppText>
                ))}
                <View style={styles.rowBetween}>
                  <AppText variant="body" color={colors.onSurfaceSecondary}>
                    Order total
                  </AppText>
                  <AppText variant="semibold">{formatINR(item.total_billing)}</AppText>
                </View>
                {item.payment_mode === "partial_cod" && item.cod_due > 0 && (
                  <View style={styles.rowBetween}>
                    <AppText variant="body" color={colors.onSurfaceSecondary}>
                      Cash on delivery
                    </AppText>
                    <AppText variant="medium">{formatINR(item.cod_due)}</AppText>
                  </View>
                )}
                {!!item.tracking_url && (
                  <Pressable
                    testID={`track-${item.id}`}
                    onPress={() => Linking.openURL(item.tracking_url).catch(() => {})}
                    style={styles.trackBtn}
                  >
                    <Feather name="truck" size={15} color={colors.brand} />
                    <AppText variant="semibold" style={styles.trackText}>
                      Track shipment{item.courier_name ? ` · ${item.courier_name}` : ""}
                    </AppText>
                    <Feather name="external-link" size={14} color={colors.muted} />
                  </Pressable>
                )}
                {item.status === "paid" && !item.instant_bv_requested && (
                  <Pressable
                    testID={`cancel-${item.id}`}
                    onPress={() => cancelOrder(item)}
                    style={styles.cancelBtn}
                  >
                    <Feather name="x-circle" size={15} color={colors.error} />
                    <AppText variant="semibold" color={colors.error} style={styles.cancelText}>
                      Cancel order
                    </AppText>
                  </Pressable>
                )}
                {item.status === "paid" && item.instant_bv_requested && (
                  <View style={styles.bvLockNote} testID={`bv-lock-${item.id}`}>
                    <Feather name="lock" size={13} color={colors.muted} />
                    <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.bvLockText}>
                      Instant BV requested — this order cannot be cancelled
                    </AppText>
                  </View>
                )}
              </View>
            )}
          />
        )}
      </KeyboardAwareScrollView>
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
  title: { fontSize: 16 },
  scroll: { padding: spacing.lg, paddingBottom: 60 },
  intro: { fontSize: 13, marginBottom: spacing.lg },
  empty: { fontSize: 13, textAlign: "center", marginTop: spacing.lg },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  code: { fontSize: 15, letterSpacing: 0.5 },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  badgeText: { fontSize: 11 },
  date: { fontSize: 12, marginTop: 2, marginBottom: spacing.sm },
  itemLine: { fontSize: 13, marginTop: 2 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  trackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  trackText: { flex: 1, fontSize: 13, color: colors.brand },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.error,
  },
  cancelText: { fontSize: 13 },
  bvLockNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bvLockText: { flex: 1, fontSize: 12, lineHeight: 16 },
});
