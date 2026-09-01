import React, { useEffect, useState } from "react";
import { View, StyleSheet, TextInput, Pressable, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";

import AppText from "./AppText";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

const PIN_KEY = "delivery_pincode";

export default function DeliveryEstimate() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    AsyncStorage.getItem(PIN_KEY).then((v) => v && setPin(v)).catch(() => {});
  }, []);

  const check = async () => {
    if (pin.length !== 6) {
      setError("Enter a 6-digit PIN code");
      setResult(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const r = await api.deliveryEstimate(pin);
      setResult(r);
      AsyncStorage.setItem(PIN_KEY, pin).catch(() => {});
    } catch (e: any) {
      setResult(null);
      setError(e?.message || "Could not check this PIN code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card} testID="delivery-estimate">
      <View style={styles.headRow}>
        <Feather name="map-pin" size={15} color={colors.brand} />
        <AppText variant="semibold" style={styles.title}>
          Estimated delivery date
        </AppText>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          testID="pincode-input"
          value={pin}
          onChangeText={(t) => setPin(t.replace(/\D/g, "").slice(0, 6))}
          keyboardType="number-pad"
          placeholder="Enter PIN code"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={check}
        />
        <Pressable testID="pincode-check" onPress={check} style={styles.checkBtn} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.onBrand} />
          ) : (
            <AppText variant="semibold" color={colors.onBrand} style={styles.checkText}>
              Check
            </AppText>
          )}
        </Pressable>
      </View>
      {!!error && (
        <AppText variant="semibold" color={colors.error} style={styles.msg} testID="pincode-error">
          {error}
        </AppText>
      )}
      {result && (
        <View style={styles.resultRow} testID="pincode-result">
          <Feather name="truck" size={14} color={colors.success} />
          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.resultText}>
            {result.district ? `Delivers to ${result.district}, ${result.state}` : `Delivers to ${result.pincode}`}
            {"\n"}
            <AppText variant="semibold" color={colors.success}>
              Expected by {result.from_date} – {result.to_date}
            </AppText>{" "}
            (incl. 2 days dispatch)
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { fontSize: 13.5 },
  inputRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    fontSize: 15,
    letterSpacing: 2,
    color: colors.onSurface,
  },
  checkBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: { fontSize: 13 },
  msg: { fontSize: 12, marginTop: spacing.sm },
  resultRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignItems: "flex-start" },
  resultText: { flex: 1, fontSize: 12.5, lineHeight: 19 },
});
