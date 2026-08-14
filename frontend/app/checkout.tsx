import React, { useState } from "react";
import { View, StyleSheet, Pressable, Modal, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { WebView } from "react-native-webview";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { useCart } from "@/src/context/CartContext";
import { useAltosAuth } from "@/src/context/AltosAuthContext";
import { getPriceInfo, formatWeight } from "@/src/utils/pricing";
import { api } from "@/src/api/client";
import { colors, spacing, formatINR } from "@/src/theme/theme";

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Checkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { lines, subtotal, shipping, total, totalWeightGrams, clear } = useCart();
  const { verified } = useAltosAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [altosId, setAltosId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [webviewUrl, setWebviewUrl] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  const validate = () => {
    if (!name.trim()) return "Please enter your name";
    if (!emailRe.test(email.trim())) return "Please enter a valid email";
    if (phone.trim().length < 6) return "Please enter a valid phone number";
    if (address.trim().length < 5) return "Please enter a delivery address";
    if (verified && !altosId.trim()) return "Please enter your Altos ID";
    return null;
  };

  const finish = async (orderId: string) => {
    clear();
    router.replace(`/order-success?order_id=${orderId}`);
  };

  const onPay = async () => {
    const err = validate();
    if (err) {
      toast.show(err);
      return;
    }
    setSubmitting(true);
    try {
      const items = lines.map((l) => ({ id: l.product.id, quantity: l.quantity }));
      const customer = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        address: address.trim(),
        altos_id: verified ? altosId.trim() : "",
      };
      const order = await api.createOrder(items, customer, verified);

      if (order.demo) {
        // Demo mode: no live Razorpay keys yet — simulate a successful payment.
        await api.demoComplete(order.order_id);
        await finish(order.order_id);
      } else {
        setPendingOrderId(order.order_id);
        setWebviewUrl(api.webviewUrl(order.order_id));
      }
    } catch (e: any) {
      toast.show(e?.message || "Could not start payment");
    } finally {
      setSubmitting(false);
    }
  };

  const onWebViewNavigate = async (navState: { url: string }) => {
    const url = navState.url;
    if (url.includes("botanica.callback/success")) {
      setWebviewUrl(null);
      try {
        const parsed = new URL(url);
        const payment_id = parsed.searchParams.get("payment_id") || "";
        const razorpay_order_id = parsed.searchParams.get("order_id") || "";
        const signature = parsed.searchParams.get("signature") || "";
        await api.verify({
          order_id: pendingOrderId!,
          razorpay_payment_id: payment_id,
          razorpay_order_id,
          razorpay_signature: signature,
        });
        await finish(pendingOrderId!);
      } catch (e: any) {
        toast.show(e?.message || "Payment verification failed");
      }
    } else if (url.includes("botanica.callback/cancel")) {
      setWebviewUrl(null);
      toast.show("Payment cancelled");
    } else if (url.includes("botanica.callback/failed")) {
      setWebviewUrl(null);
      toast.show("Payment failed. Please try again.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="checkout-back" onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="displaySemiBold" style={styles.headerTitle}>
          Checkout
        </AppText>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <AppText variant="displayMedium" style={styles.sectionTitle}>
          Delivery details
        </AppText>

        <FormField
          testID="input-name"
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="Jane Doe"
          autoCapitalize="words"
        />
        <FormField
          testID="input-email"
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="jane@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <FormField
          testID="input-phone"
          label="Phone"
          value={phone}
          onChangeText={setPhone}
          placeholder="9876543210"
          keyboardType="phone-pad"
        />
        <FormField
          testID="input-address"
          label="Delivery address"
          value={address}
          onChangeText={setAddress}
          placeholder="Flat, street, city, PIN"
          multiline
          numberOfLines={3}
          style={styles.addressInput}
        />
        {verified && (
          <FormField
            testID="input-altos-id"
            label="Altos ID (for BV generation)"
            value={altosId}
            onChangeText={setAltosId}
            placeholder="Your Altos member ID"
            autoCapitalize="characters"
          />
        )}

        <View style={styles.divider} />

        <AppText variant="displayMedium" style={styles.sectionTitle}>
          Order summary
        </AppText>
        {lines.map((l) => (
          <View key={l.product.id} style={styles.summaryRow}>
            <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.summaryName}>
              {l.product.name} × {l.quantity}
            </AppText>
            <AppText variant="medium">
              {formatINR(getPriceInfo(l.product, verified).unit * l.quantity)}
            </AppText>
          </View>
        ))}
        <View style={[styles.summaryRow, { marginTop: spacing.md }]}>
          <AppText variant="body" color={colors.onSurfaceSecondary}>
            Subtotal
          </AppText>
          <AppText variant="medium">{formatINR(subtotal)}</AppText>
        </View>
        <View style={styles.summaryRow}>
          <AppText variant="body" color={colors.onSurfaceSecondary}>
            Shipping{totalWeightGrams > 0 ? ` (${formatWeight(totalWeightGrams)})` : ""}
          </AppText>
          {shipping > 0 ? (
            <AppText variant="medium" testID="checkout-shipping">
              {formatINR(shipping)}
            </AppText>
          ) : (
            <AppText variant="medium" color={colors.success} testID="checkout-shipping">
              Free
            </AppText>
          )}
        </View>
        <View style={[styles.summaryRow, { marginTop: spacing.sm }]}>
          <AppText variant="displaySemiBold" style={styles.totalText}>
            Total
          </AppText>
          <AppText variant="displaySemiBold" style={styles.totalText}>
            {formatINR(total)}
          </AppText>
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="pay-button"
            label={`Pay with Razorpay · ${formatINR(total)}`}
            onPress={onPay}
            loading={submitting}
            disabled={lines.length === 0}
          />
        </View>
      </KeyboardStickyView>

      <Modal visible={!!webviewUrl} animationType="slide" onRequestClose={() => setWebviewUrl(null)}>
        <View style={styles.webviewContainer}>
          <View style={[styles.webviewHeader, { paddingTop: insets.top + spacing.sm }]}>
            <Pressable onPress={() => setWebviewUrl(null)} hitSlop={8} testID="close-payment">
              <Feather name="x" size={22} color={colors.onSurface} />
            </Pressable>
            <AppText variant="semibold">Secure Payment</AppText>
            <View style={{ width: 22 }} />
          </View>
          {webviewUrl && (
            <WebView
              source={{ uri: webviewUrl }}
              onNavigationStateChange={onWebViewNavigate}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: { fontSize: 22 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 140,
  },
  sectionTitle: {
    fontSize: 24,
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  addressInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginVertical: spacing.xl,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  summaryName: { flex: 1, marginRight: spacing.md, fontSize: 14 },
  totalText: { fontSize: 22 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  webviewContainer: { flex: 1, backgroundColor: colors.surface },
  webviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  webLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
});
