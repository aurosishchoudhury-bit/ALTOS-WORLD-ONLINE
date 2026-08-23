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
import { useAdminAuth } from "@/src/context/AdminAuthContext";
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
  const [youtube, setYoutube] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [xUrl, setXUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const { sessionToken, lock } = useAdminAuth();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [changingPin, setChangingPin] = useState(false);

  const changePin = async () => {
    if (newPin.length < 6 || !/^\d+$/.test(newPin)) {
      toast.show("New PIN must be 6-12 digits");
      return;
    }
    setChangingPin(true);
    try {
      await api.changeAdminPin(sessionToken || "", currentPin, newPin);
      toast.show("PIN changed — unlock again with your new PIN");
      setCurrentPin("");
      setNewPin("");
      lock();
    } catch (e: any) {
      toast.show(e?.message || "Could not change PIN");
    } finally {
      setChangingPin(false);
    }
  };

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
      setYoutube(s.youtube_url || "");
      setFacebook(s.facebook_url || "");
      setInstagram(s.instagram_url || "");
      setXUrl(s.x_url || "");
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
        youtube_url: youtube.trim(),
        facebook_url: facebook.trim(),
        instagram_url: instagram.trim(),
        x_url: xUrl.trim(),
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

        <View style={styles.divider} />
        <AppText variant="displaySemiBold" style={styles.section}>
          Social Media Links
        </AppText>
        <AppText variant="body" color={colors.muted} style={styles.hint}>
          Leave blank to hide an icon. Links appear in the customer menu.
        </AppText>
        <FormField testID="social-youtube" label="YouTube URL" value={youtube} onChangeText={setYoutube} autoCapitalize="none" placeholder="https://youtube.com/@yourchannel" />
        <FormField testID="social-facebook" label="Facebook URL" value={facebook} onChangeText={setFacebook} autoCapitalize="none" placeholder="https://facebook.com/yourpage" />
        <FormField testID="social-instagram" label="Instagram URL" value={instagram} onChangeText={setInstagram} autoCapitalize="none" placeholder="https://instagram.com/yourhandle" />
        <FormField testID="social-x" label="X (Twitter) URL" value={xUrl} onChangeText={setXUrl} autoCapitalize="none" placeholder="https://x.com/yourhandle" />

        <Button testID="save-settings" label="Save Settings" onPress={save} loading={saving} style={{ marginTop: spacing.xl }} />

        <AppText variant="semibold" style={{ fontSize: 15, marginTop: spacing.xl * 1.5, marginBottom: spacing.sm }}>
          Admin PIN
        </AppText>
        <AppText variant="body" color={colors.muted} style={{ fontSize: 12, marginBottom: spacing.md }}>
          This PIN protects the hidden admin panel (opened by tapping the home logo 7 times).
        </AppText>
        <FormField
          testID="current-pin"
          label="Current PIN"
          value={currentPin}
          onChangeText={setCurrentPin}
          placeholder="Current PIN"
          keyboardType="number-pad"
          secureTextEntry
        />
        <FormField
          testID="new-pin"
          label="New PIN (6-12 digits)"
          value={newPin}
          onChangeText={setNewPin}
          placeholder="New PIN"
          keyboardType="number-pad"
          secureTextEntry
        />
        <Button testID="change-pin" label="Change PIN" onPress={changePin} loading={changingPin} />
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
  hint: { fontSize: 12, marginBottom: spacing.md },
});
