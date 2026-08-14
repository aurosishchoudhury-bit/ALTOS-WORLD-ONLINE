import React from "react";
import { View, Pressable, StyleSheet, Dimensions } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import AppText from "./AppText";
import { colors, spacing, formatINR } from "@/src/theme/theme";
import { Product } from "@/src/api/client";
import { useAltosAuth } from "@/src/context/AltosAuthContext";
import { getPriceInfo, discountPercent } from "@/src/utils/pricing";

const { width } = Dimensions.get("window");
const CARD_W = (width - spacing.lg * 2 - spacing.lg) / 2;

type Props = {
  product: Product;
  onPress: () => void;
  onAdd: () => void;
};

export default function ProductCard({ product, onPress, onAdd }: Props) {
  const { verified } = useAltosAuth();
  const priceInfo = getPriceInfo(product, verified);

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onAdd();
  };

  return (
    <Pressable
      testID={`product-card-${product.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: resolveImageUri(product.image) }}
          style={styles.image}
          contentFit="cover"
          transition={250}
        />
        <Pressable
          testID={`quick-add-${product.id}`}
          onPress={handleAdd}
          style={styles.addBtn}
          hitSlop={8}
        >
          <Feather name="plus" size={18} color={colors.onSurface} />
        </Pressable>
      </View>
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.category}>
        {product.weight ? product.weight : product.category}
      </AppText>
      <AppText variant="displayMedium" style={styles.name} numberOfLines={2}>
        {product.name}
      </AppText>
      <View style={styles.priceRow}>
        <AppText variant="medium" style={styles.price}>
          {formatINR(priceInfo.unit)}
        </AppText>
        {priceInfo.compareAt !== null && (
          <>
            <AppText variant="body" color={colors.muted} style={styles.mrp}>
              {formatINR(priceInfo.compareAt)}
            </AppText>
            <AppText variant="semibold" color={colors.success} style={styles.discount}>
              {discountPercent(priceInfo)}% OFF
            </AppText>
          </>
        )}
      </View>
      {verified && Number(product.bv) > 0 && (
        <AppText variant="semibold" color={colors.brand} style={styles.bvText}>
          BV {Number(product.bv)}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    marginBottom: spacing.xl,
  },
  pressed: { opacity: 0.85 },
  imageWrap: {
    width: "100%",
    aspectRatio: 4 / 5,
    backgroundColor: colors.surfaceSecondary,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  addBtn: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  category: {
    marginTop: spacing.sm,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  name: {
    marginTop: 2,
    fontSize: 19,
    lineHeight: 22,
  },
  price: {
    marginTop: 2,
    fontSize: 14,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  mrp: {
    fontSize: 12,
    textDecorationLine: "line-through",
  },
  discount: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  bvText: {
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.3,
  },
});
