import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import { api } from "@/src/api/client";
import {
  openWhatsApp,
  orderConfirmationMessage,
  orderCode,
  STORE_WHATSAPP,
} from "@/src/utils/whatsapp";
import { colors, spacing, radius, formatINR } from "@/src/theme/theme";

export default function OrderSuccess() {
  const { order_id } = useLocalSearchParams<{ order_id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);

  const bvMessage = order
    ? `Hi Altos World! Payment is done for my order ${orderCode(order.id)} (${formatINR(order.amount)}). Kindly generate BV ASAP. Total BV: ${order.total_bv || 0}. Altos ID: ${order.customer?.altos_id || "-"}, Name: ${order.customer?.name || ""}, Phone: ${order.customer?.phone || ""}.`
    : "";

  useEffect(() => {
    if (order_id) {
      api.getOrder(order_id).then(setOrder).catch(() => {});
    }
  }, [order_id]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
            Your order has been placed successfully. We&rsquo;ll send confirmation to your email shortly.
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
                {order.payment_mode === "partial_cod" ? "Paid now (30% advance)" : "Total paid"}
              </AppText>
              <AppText variant="semibold">{formatINR(order.amount)}</AppText>
            </View>
            {order.payment_mode === "partial_cod" && (
              <>
                <View style={styles.cardRow}>
                  <AppText variant="body" color={colors.onSurfaceSecondary}>
                    Cash on delivery
                  </AppText>
                  <AppText variant="semibold" testID="success-cod-due">
                    {formatINR(order.cod_due || 0)}
                  </AppText>
                </View>
                <View style={styles.cardRow}>
                  <AppText variant="body" color={colors.onSurfaceSecondary}>
                    Order total
                  </AppText>
                  <AppText variant="medium">{formatINR(order.total_billing || order.amount)}</AppText>
                </View>
              </>
            )}
          </Animated.View>
        )}

        {order?.altos_verified && (
          <Animated.View entering={FadeInDown.delay(520).duration(500)} style={styles.bvSection}>
          <View style={styles.bvOption} testID="bv-option-dispatch">
            <View style={styles.bvBadge}>
              <AppText variant="semibold" color={colors.brand} style={styles.bvBadgeText}>
                1
              </AppText>
            </View>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.bvText}>
              BV will be generated once your product is dispatched.
            </AppText>
          </View>

          <Pressable
            testID="bv-option-instant"
            onPress={() => openWhatsApp(bvMessage, STORE_WHATSAPP)}
            style={styles.bvOptionInstant}
          >
            <View style={[styles.bvBadge, styles.bvBadgeGreen]}>
              <AppText variant="semibold" color="#FFFFFF" style={styles.bvBadgeText}>
                2
              </AppText>
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="semibold" style={styles.bvInstantTitle}>
                For instant BV generation, click here
              </AppText>
              <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.bvInstantSub}>
                Sends us a WhatsApp message to generate your BV right away
              </AppText>
            </View>
            <Feather name="message-circle" size={20} color="#25D366" />
          </Pressable>
          </Animated.View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {order && (
          <Button
            testID="whatsapp-share-button"
            label="Share confirmation on WhatsApp"
            onPress={() => openWhatsApp(orderConfirmationMessage(order))}
            style={styles.whatsappBtn}
          />
        )}
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
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
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
    gap: spacing.md,
  },
  whatsappBtn: {
    backgroundColor: "#25D366",
  },
  bvSection: {
    width: "100%",
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  bvOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  bvOptionInstant: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: "#25D366",
    borderRadius: radius.lg,
    backgroundColor: "#F0FBF4",
  },
  bvBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  bvBadgeGreen: {
    backgroundColor: "#25D366",
    borderColor: "#25D366",
  },
  bvBadgeText: { fontSize: 13 },
  bvText: { flex: 1, fontSize: 13, lineHeight: 19 },
  bvInstantTitle: { fontSize: 14 },
  bvInstantSub: { fontSize: 12, marginTop: 2 },
});
