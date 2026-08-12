import React from "react";
import { Pressable, StyleSheet, ActivityIndicator, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

import AppText from "./AppText";
import { colors, radius, spacing } from "@/src/theme/theme";

type Props = {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: ViewStyle;
  haptic?: Haptics.ImpactFeedbackStyle;
};

export default function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  testID,
  style,
  haptic = Haptics.ImpactFeedbackStyle.Medium,
}: Props) {
  const isPrimary = variant === "primary";
  const isSecondary = variant === "secondary";

  const handle = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(haptic).catch(() => {});
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handle}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        variant === "ghost" && styles.ghost,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onBrand : colors.onSurface} />
      ) : (
        <AppText
          variant="semibold"
          color={isPrimary ? colors.onBrand : colors.onSurface}
          style={styles.label}
        >
          {label}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  primary: {
    backgroundColor: colors.brand,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.85,
  },
  label: {
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
