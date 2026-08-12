import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import AppText from "./AppText";
import { colors, radius } from "@/src/theme/theme";

type Props = {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  testIDPrefix?: string;
};

export default function QuantityStepper({ value, onChange, min = 0, testIDPrefix = "qty" }: Props) {
  const step = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(Math.max(min, value + delta));
  };

  return (
    <View style={styles.row}>
      <Pressable
        testID={`${testIDPrefix}-decrease`}
        onPress={() => step(-1)}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Feather name="minus" size={16} color={colors.onSurface} />
      </Pressable>
      <AppText variant="medium" style={styles.value} testID={`${testIDPrefix}-value`}>
        {value}
      </AppText>
      <Pressable
        testID={`${testIDPrefix}-increase`}
        onPress={() => step(1)}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Feather name="plus" size={16} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  btn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.5 },
  value: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 15,
  },
});
