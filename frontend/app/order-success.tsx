import React, { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import { api } from "@/src/api/client";
import { colors, spacing, formatINR } from "@/src/theme/theme";

export default function OrderSuccess() {
  const { order_id } = useLocalSearchParams<{ order_id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    if (order_id) {
      api.getOrder(order_id).then(setOrder).catch(() => {});
    }
  }, [order_id]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Animated.View entering={FadeIn.duration(400)} style={styles.checkCircle}>
          <Feather name="check" size={40} color={colors.onBrand} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <AppText variant="display" style={styles.title}>
            Thank you
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(280).duration(500)}>
          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.sub}>
            Your order has been placed successfully. We'll send confirmation to your email shortly.
          </AppText>
        </Animated.View>

        {order && (
          <Animated.View entering={FadeInDown.delay(400).duration(500)} style={styles.card}>
            <View style={styles.cardRow}>
              <AppText variant="body" color={colors.onSurfaceSecondary}>
                Order ID
              </AppText>
              <AppText variant="medium" testID="order-id">
                #{String(order.id).slice(0, 8).toUpperCase()}
              </AppText>
            </View>
            <View style={styles.cardRow}>
              <AppText variant="body" color={colors.onSurfaceSecondary}>
                Items
              </AppText>
              <AppText variant="medium">
                {order.items?.reduce((s: number, i: any) => s + i.quantity, 0)}
              </AppText>
            </View>
            <View style={styles.cardRow}>
              <AppText variant="body" color={colors.onSurfaceSecondary}>
                Total paid
              </AppText>
              <AppText variant="semibold">{formatINR(order.amount)}</AppText>
            </View>
          </Animated.View>
        )}
      </View>

      <View style={styles.footer}>
        <Button
          testID="continue-shopping-button"
          label="Continue Shopping"
          onPress={() => router.replace("/")}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 48,
    textAlign: "center",
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: spacing.md,
    maxWidth: 300,
  },
  card: {
    width: "100%",
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.xl,
    marginTop: spacing["2xl"],
    gap: spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footer: {
    paddingBottom: spacing.md,
  },
});
