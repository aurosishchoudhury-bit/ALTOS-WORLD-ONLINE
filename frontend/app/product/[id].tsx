import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import QuantityStepper from "@/src/components/QuantityStepper";
import { useCart } from "@/src/context/CartContext";
import { useToast } from "@/src/components/Toast";
import { api, Product } from "@/src/api/client";
import { colors, spacing, formatINR } from "@/src/theme/theme";

const { width } = Dimensions.get("window");

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const toast = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getProduct(id);
        setProduct(p);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const onAdd = () => {
    if (!product) return;
    addItem(product, qty);
    toast.show(`Added ${qty} to cart`);
    router.back();
  };

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  if (error || !product) {
    return (
      <View style={styles.centerScreen}>
        <Feather name="alert-circle" size={28} color={colors.muted} />
        <AppText variant="displayMedium" style={{ fontSize: 20 }}>
          Product not found
        </AppText>
        <Pressable onPress={() => router.back()}>
          <AppText variant="semibold" color={colors.brand}>
            Go back
          </AppText>
        </Pressable>
      </View>
    );
  }

  const outOfStock = product.stock <= 0;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={styles.imageWrap}>
          <Image source={{ uri: product.image }} style={styles.image} contentFit="cover" />
          <Pressable
            testID="back-button"
            onPress={() => router.back()}
            style={[styles.backBtn, { top: insets.top + spacing.sm }]}
            hitSlop={8}
          >
            <Feather name="arrow-left" size={20} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={styles.body}>
          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.category}>
            {product.category}
          </AppText>
          <AppText variant="display" style={styles.title}>
            {product.name}
          </AppText>
          <AppText variant="medium" style={styles.price}>
            {formatINR(product.price)}
          </AppText>

          <View style={styles.divider} />

          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.description}>
            {product.description}
          </AppText>

          <View style={styles.qtyRow}>
            <AppText variant="semibold" style={styles.qtyLabel}>
              Quantity
            </AppText>
            <QuantityStepper value={qty} onChange={(v) => setQty(Math.max(1, v))} min={1} />
          </View>

          <AppText
            variant="body"
            color={outOfStock ? colors.error : colors.success}
            style={styles.stock}
          >
            {outOfStock ? "Out of stock" : `In stock · ${product.stock} available`}
          </AppText>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          testID="add-to-cart-button"
          label={outOfStock ? "Out of stock" : `Add to Cart · ${formatINR(product.price * qty)}`}
          onPress={onAdd}
          disabled={outOfStock}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  centerScreen: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  imageWrap: {
    width: width,
    height: width * 1.1,
    backgroundColor: colors.surfaceSecondary,
  },
  image: { width: "100%", height: "100%" },
  backBtn: {
    position: "absolute",
    left: spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    padding: spacing.xl,
  },
  category: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    marginTop: spacing.xs,
  },
  price: {
    fontSize: 18,
    marginTop: spacing.sm,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginVertical: spacing.xl,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xl,
  },
  qtyLabel: { fontSize: 15 },
  stock: {
    marginTop: spacing.lg,
    fontSize: 13,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
