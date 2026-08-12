import React from "react";
import { Text, TextProps, StyleSheet } from "react-native";

import { colors, fonts } from "@/src/theme/theme";

type Variant =
  | "display"
  | "displayMedium"
  | "displaySemiBold"
  | "body"
  | "medium"
  | "semibold";

type Props = TextProps & {
  variant?: Variant;
  color?: string;
};

const familyFor: Record<Variant, string> = {
  display: fonts.display,
  displayMedium: fonts.displayMedium,
  displaySemiBold: fonts.displaySemiBold,
  body: fonts.text,
  medium: fonts.textMedium,
  semibold: fonts.textSemiBold,
};

export default function AppText({ variant = "body", color, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[
        styles.base,
        { fontFamily: familyFor[variant], color: color ?? colors.onSurface },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    fontSize: 14,
  },
});
