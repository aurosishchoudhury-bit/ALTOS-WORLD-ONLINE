import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

import { colors } from "@/src/theme/theme";

type Props = {
  value: number; // 0-5
  size?: number;
  onChange?: (v: number) => void; // when provided, stars are tappable
};

export default function Stars({ value, size = 14, onChange }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i - 0.25;
        const star = (
          <FontAwesome
            name={filled ? "star" : "star-o"}
            size={size}
            color={filled ? "#E8A93C" : colors.borderStrong}
          />
        );
        return onChange ? (
          <Pressable key={i} testID={`star-${i}`} onPress={() => onChange(i)} hitSlop={6}>
            {star}
          </Pressable>
        ) : (
          <View key={i}>{star}</View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 3 },
});
