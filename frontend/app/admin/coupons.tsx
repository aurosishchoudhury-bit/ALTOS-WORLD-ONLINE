import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, Modal, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

const todayStr = () => new Date().toISOString().slice(0, 10);

const couponSummary = (c: any) => {
  const disc = c.discount_type === "percent" ? `${c.value}% off` : `₹${c.value} off`;
  const who = c.audience === "altos" ? "Altos ID holders" : "Non-Altos customers";
  return `${disc} · ${who} · till ${c.end_date}`;
};

export default function ManageCoupons() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [coupons, setCoupons] = useState<any[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState("");
  const [audience, setAudience] = useState<"non_altos" | "altos">("non_altos");
  const [minOrder, setMinOrder] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);

  const load = useCallback(() => {
    api.listCoupons().then(setCoupons).catch(() => {});
  }, []);

  useFocusEffect(load);

  const openForm = (coupon?: any) => {
    setEditing(coupon || null);
    setCode(coupon?.code || "");
    setDescription(coupon?.description || "");
    setDiscountType(coupon?.discount_type || "percent");
    setValue(coupon ? String(coupon.value) : "");
    setAudience(coupon?.audience || "non_altos");
    setMinOrder(coupon?.min_order ? String(coupon.min_order) : "");
    setStartDate(coupon?.start_date || todayStr());
    setEndDate(coupon?.end_date || "");
    setActive(coupon ? !!coupon.active : true);
    setModal(true);
  };

  const save = async () => {
    if (code.trim().length < 3) return toast.show("Enter a coupon code (min 3 characters)");
    const num = parseFloat(value);
    if (!num || num <= 0) return toast.show("Enter a valid discount value");
    if (discountType === "percent" && num > 100) return toast.show("Percent cannot exceed 100");
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRe.test(startDate)) return toast.show("Start date must be YYYY-MM-DD");
    if (!dateRe.test(endDate)) return toast.show("End date must be YYYY-MM-DD");
    if (endDate < startDate) return toast.show("End date must be after start date");
    setSaving(true);
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        description: description.trim(),
        discount_type: discountType,
        value: num,
        audience,
        min_order: parseFloat(minOrder) || 0,
        start_date: startDate,
        end_date: endDate,
        active,
      };
      if (editing) {
        await api.updateCoupon(editing.id, payload);
      } else {
        await api.createCoupon(payload);
      }
      toast.show(editing ? "Coupon updated" : "Coupon created");
      setModal(false);
      load();
    } catch (e: any) {
      toast.show(e?.message || "Could not save coupon");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c: any) => {
    try {
      await api.deleteCoupon(c.id);
      setCoupons((prev) => prev.filter((x) => x.id !== c.id));
      toast.show("Deleted");
    } catch {
      toast.show("Could not delete");
    }
  };

  const chip = (label: string, on: boolean, onPress: () => void, testID: string) => (
    <Pressable testID={testID} onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      <AppText variant={on ? "semibold" : "body"} color={on ? "#fff" : colors.onSurface} style={styles.chipText}>
        {label}
      </AppText>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="coupons-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Coupons
        </AppText>
        <Pressable testID="add-coupon" onPress={() => openForm()} hitSlop={12} style={styles.backBtn}>
          <Feather name="plus" size={22} color={colors.brand} />
        </Pressable>
      </View>

      <FlatList
        data={coupons}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        ListEmptyComponent={
          <AppText variant="body" color={colors.muted} style={styles.empty}>
            No coupons yet. Tap + to create a discount for Altos ID holders or regular customers.
          </AppText>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, !item.active && styles.cardInactive]} testID={`coupon-${item.id}`}>
            <View style={{ flex: 1 }}>
              <View style={styles.codeRow}>
                <AppText variant="semibold" style={styles.code}>
                  {item.code}
                </AppText>
                {!item.active && (
                  <View style={styles.inactiveBadge}>
                    <AppText variant="semibold" style={styles.inactiveBadgeText}>
                      Inactive
                    </AppText>
                  </View>
                )}
              </View>
              <AppText variant="body" color={colors.muted} style={styles.summary}>
                {couponSummary(item)}
              </AppText>
              <AppText variant="body" color={colors.muted} style={styles.summary}>
                {item.min_order > 0 ? `Min order ₹${item.min_order} · ` : ""}Used {item.used_count || 0} time
                {(item.used_count || 0) === 1 ? "" : "s"}
              </AppText>
            </View>
            <Pressable testID={`edit-coupon-${item.id}`} onPress={() => openForm(item)} hitSlop={8} style={styles.iconBtn}>
              <Feather name="edit-2" size={17} color={colors.onSurface} />
            </Pressable>
            <Pressable testID={`delete-coupon-${item.id}`} onPress={() => remove(item)} hitSlop={8} style={styles.iconBtn}>
              <Feather name="trash-2" size={17} color={colors.error} />
            </Pressable>
          </View>
        )}
      />

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <AppText variant="displaySemiBold" style={styles.modalTitle}>
                {editing ? "Edit" : "Create"} Coupon
              </AppText>
              <FormField
                testID="coupon-code"
                label="Coupon code"
                value={code}
                onChangeText={(t: string) => setCode(t.toUpperCase())}
                placeholder="e.g. WELCOME10"
                autoCapitalize="characters"
              />
              <FormField
                testID="coupon-description"
                label="Description (optional)"
                value={description}
                onChangeText={setDescription}
                placeholder="e.g. Welcome offer for new customers"
              />
              <AppText variant="semibold" style={styles.pickLabel}>
                Discount type
              </AppText>
              <View style={styles.chipRow}>
                {chip("Percentage %", discountType === "percent", () => setDiscountType("percent"), "type-percent")}
                {chip("Flat ₹", discountType === "flat", () => setDiscountType("flat"), "type-flat")}
              </View>
              <FormField
                testID="coupon-value"
                label={discountType === "percent" ? "Discount (%)" : "Discount amount (₹)"}
                value={value}
                onChangeText={setValue}
                placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 100"}
                keyboardType="numeric"
              />
              <AppText variant="semibold" style={styles.pickLabel}>
                Who can use it?
              </AppText>
              <View style={styles.chipRow}>
                {chip("Non-Altos customers", audience === "non_altos", () => setAudience("non_altos"), "aud-non-altos")}
                {chip("Altos ID holders", audience === "altos", () => setAudience("altos"), "aud-altos")}
              </View>
              <FormField
                testID="coupon-min-order"
                label="Minimum order value (₹, optional)"
                value={minOrder}
                onChangeText={setMinOrder}
                placeholder="e.g. 500 (leave blank for none)"
                keyboardType="numeric"
              />
              <FormField
                testID="coupon-start"
                label="Valid from (YYYY-MM-DD)"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-06-01"
              />
              <FormField
                testID="coupon-end"
                label="Valid until (YYYY-MM-DD)"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-06-30"
              />
              <Pressable testID="coupon-active" onPress={() => setActive((a) => !a)} style={styles.activeRow}>
                <Feather
                  name={active ? "check-square" : "square"}
                  size={18}
                  color={active ? colors.brand : colors.muted}
                />
                <AppText variant="body" style={styles.activeText}>
                  Active (customers can redeem)
                </AppText>
              </Pressable>
              <View style={styles.modalActions}>
                <Button label="Cancel" variant="secondary" onPress={() => setModal(false)} style={{ flex: 1 }} />
                <Button testID="save-coupon" label="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
              </View>
            </ScrollView>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16 },
  empty: { fontSize: 13, textAlign: "center", marginTop: spacing.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.md,
  },
  cardInactive: { opacity: 0.55 },
  codeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  code: { fontSize: 15, letterSpacing: 0.5 },
  inactiveBadge: {
    backgroundColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  inactiveBadgeText: { fontSize: 10, color: colors.muted },
  summary: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20,24,20,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "88%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: { fontSize: 20, marginBottom: spacing.lg },
  pickLabel: { fontSize: 13, marginBottom: spacing.sm },
  chipRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill ?? 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13 },
  activeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  activeText: { fontSize: 14 },
  modalActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
});
