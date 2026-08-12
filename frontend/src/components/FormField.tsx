import React from "react";
import { View, TextInput, StyleSheet, TextInputProps } from "react-native";

import AppText from "./AppText";
import { colors, fonts, radius, spacing } from "@/src/theme/theme";

type Props = TextInputProps & {
  label: string;
  testID?: string;
};

export default function FormField({ label, testID, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      <AppText variant="medium" color={colors.onSurfaceSecondary} style={styles.label}>
        {label}
      </AppText>
      <TextInput
        testID={testID}
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    fontSize: 12,
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.onSurface,
    backgroundColor: colors.surface,
  },
});
