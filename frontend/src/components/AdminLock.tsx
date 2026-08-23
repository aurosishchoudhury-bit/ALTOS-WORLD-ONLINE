import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "./AppText";
import Button from "./Button";
import { useAdminAuth } from "@/src/context/AdminAuthContext";
import { colors, spacing, radius } from "@/src/theme/theme";

export default function AdminLock() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { unlock } = useAdminAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (pin.length < 4) {
      setError("Enter your admin PIN");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await unlock(pin);
      setPin("");
    } catch (e: any) {
      setError(e?.message || "Incorrect PIN");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
      <Pressable testID="lock-back" onPress={() => router.replace("/(tabs)")} hitSlop={12} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color={colors.onSurface} />
      </Pressable>
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Feather name="lock" size={28} color={colors.brand} />
        </View>
        <AppText variant="displaySemiBold" style={styles.title}>
          Admin Access
        </AppText>
        <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.sub}>
          Enter your admin PIN to continue
        </AppText>
        <TextInput
          testID="admin-pin-input"
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, ""))}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={12}
          placeholder="Admin PIN"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={submit}
        />
        {!!error && (
          <AppText variant="semibold" color={colors.error} style={styles.error}>
            {error}
          </AppText>
        )}
        <Button testID="admin-pin-submit" label="Unlock" onPress={submit} loading={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.xl },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, justifyContent: "center", paddingBottom: 120, gap: spacing.md },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  title: { fontSize: 22, textAlign: "center" },
  sub: { fontSize: 14, textAlign: "center", marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    fontSize: 18,
    letterSpacing: 6,
    textAlign: "center",
    color: colors.onSurface,
  },
  error: { fontSize: 13, textAlign: "center" },
});
