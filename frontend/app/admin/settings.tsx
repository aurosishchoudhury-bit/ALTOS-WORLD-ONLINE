import React, { useCallback, useState } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

export default function StoreSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [mode, setMode] = useState<"weight" | "flat">("weight");
  const [freeUpto, setFreeUpto] = useState("3000");
  const [midUpto, setMidUpto] = useState("5000");
  const [midCharge, setMidCharge] = useState("50");
  const [highCharge, setHighCharge] = useState("100");
  const [flatCharge, setFlatCharge] = useState("50");
  const [freeAbove, setFreeAbove] = useState("0");
  const [minRegular, setMinRegular] = useState("399");
  const [minAltos, setMinAltos] = useState("599");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.getSettings().then((s) => {
      setMode(s.shipping_mode);
      setFreeUpto(String(s.free_upto_grams));
      setMidUpto(String(s.mid_upto_grams));
      setMidCharge(String(s.mid_charge));
      setHighCharge(String(s.high_charge));
      setFlatCharge(String(s.flat_charge));
      setFreeAbove(String(s.free_above_amount));
      setMinRegular(String(s.min_purchase_regular));
      setMinAltos(String(s.min_purchase_altos));
    }).catch(() => {});
  }, []);

  useFocusEffect(load);

  const num = (v: string) => parseFloat(v) || 0;

  const save = async () => {
    setSaving(true);
    try {
      await api.updateSettings({
        shipping_mode: mode,
        free_upto_grams: num(freeUpto),
        mid_upto_grams: num(midUpto),
        mid_charge: num(midCharge),
        high_charge: num(highCharge),
        flat_charge: num(flatCharge),
        free_above_amount: num(freeAbove),
        min_purchase_regular: num(minRegular),
        min_purchase_altos: num(minAltos),
      });
      toast.show("Settings saved");
      router.back();
    } catch (e: any) {
      toast.show(e?.message || "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="settings-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Store Settings
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <KeyboardAwareScrollView bottomOffset={90} contentContainerStyle={styles.scroll}>
        <AppText variant="displaySemiBold" style={styles.section}>
          Shipping
        </AppText>
        <View style={styles.chipRow}>
          <Pressable
            testID="ship-mode-weight"
            onPress={() => setMode("weight")}
            style={[styles.chip, mode === "weight" && styles.chipOn]}
          >
            <AppText variant={mode === "weight" ? "semibold" : "body"} color={mode === "weight" ? "#fff" : colors.onSurface} style={styles.chipText}>
              Weight-based
            </AppText>
          </Pressable>
          <Pressable
            testID="ship-mode-flat"
            onPress={() => setMode("flat")}
            style={[styles.chip, mode === "flat" && styles.chipOn]}
          >
            <AppText variant={mode === "flat" ? "semibold" : "body"} color={mode === "flat" ? "#fff" : colors.onSurface} style={styles.chipText}>
              Flat rate
            </AppText>
          </Pressable>
        </View>

        {mode === "weight" ? (
          <>
            <FormField testID="free-upto" label="Free shipping up to (grams)" value={freeUpto} onChangeText={setFreeUpto} keyboardType="numeric" placeholder="3000" />
            <FormField testID="mid-charge" label="Charge above that, up to next tier (₹)" value={midCharge} onChangeText={setMidCharge} keyboardType="numeric" placeholder="50" />
            <FormField testID="mid-upto" label="Next tier limit (grams)" value={midUpto} onChangeText={setMidUpto} keyboardType="numeric" placeholder="5000" />
            <FormField testID="high-charge" label="Charge above next tier (₹)" value={highCharge} onChangeText={setHighCharge} keyboardType="numeric" placeholder="100" />
          </>
        ) : (
          <>
            <FormField testID="flat-charge" label="Flat shipping fee (₹)" value={flatCharge} onChangeText={setFlatCharge} keyboardType="numeric" placeholder="50" />
            <FormField testID="free-above" label="Free shipping above order value (₹, 0 = never)" value={freeAbove} onChangeText={setFreeAbove} keyboardType="numeric" placeholder="0" />
          </>
        )}

        <View style={styles.divider} />
        <AppText variant="displaySemiBold" style={styles.section}>
          Minimum Order Value
        </AppText>
        <FormField testID="min-regular" label="Non-Altos customers (₹)" value={minRegular} onChangeText={setMinRegular} keyboardType="numeric" placeholder="399" />
        <FormField testID="min-altos" label="Altos ID holders (₹)" value={minAltos} onChangeText={setMinAltos} keyboardType="numeric" placeholder="599" />

        <Button testID="save-settings" label="Save Settings" onPress={save} loading={saving} style={{ marginTop: spacing.xl }} />
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
  scroll: { padding: spacing.lg, paddingBottom: 80 },
  section: { fontSize: 20, marginBottom: spacing.md },
  chipRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  chipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  chipText: { fontSize: 13 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl },
});
