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
  const { lines, subtotal, shipping, total, totalWeightGrams, totalBV, clear } = useCart();
  const { verified } = useAltosAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [altosId, setAltosId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [webviewUrl, setWebviewUrl] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponModal, setCouponModal] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<any[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"full" | "partial_cod">("full");

  const billing = Math.max(0, total - (coupon?.discount || 0));
  const usePartial = !verified && paymentMode === "partial_cod";
  const onlineNow = usePartial ? Math.round(billing * 0.3 * 100) / 100 : billing;
  const codDue = usePartial ? Math.round((billing - onlineNow) * 100) / 100 : 0;

  const openCoupons = async () => {
    if (phone.trim().length < 6) {
      toast.show("Enter your phone number first to view coupons");
      return;
    }
    setCouponModal(true);
    setLoadingCoupons(true);
    try {
      const list = await api.availableCoupons(verified, phone.trim(), subtotal);
      setAvailableCoupons(list);
    } catch {
      setAvailableCoupons([]);
    } finally {
      setLoadingCoupons(false);
    }
  };

  const applyCoupon = async (c: any) => {
    try {
      const res = await api.validateCoupon(c.code, phone.trim(), verified, subtotal);
      setCoupon({ code: res.code, discount: res.discount });
      setCouponModal(false);
      toast.show(`Coupon ${res.code} applied — you save ${formatINR(res.discount)}`);
    } catch (e: any) {
      toast.show(e?.message || "Could not apply coupon");
    }
  };

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
      const order = await api.createOrder(
        items,
        customer,
        verified,
        coupon?.code || "",
        usePartial ? "partial_cod" : "full",
      );

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
        {coupon ? (
          <View style={styles.summaryRow}>
            <View style={styles.couponApplied}>
              <Feather name="tag" size={14} color={colors.success} />
              <AppText variant="body" color={colors.onSurfaceSecondary}>
                Coupon ({coupon.code})
              </AppText>
              <Pressable testID="remove-coupon" onPress={() => setCoupon(null)} hitSlop={8}>
                <Feather name="x-circle" size={15} color={colors.muted} />
              </Pressable>
            </View>
            <AppText variant="medium" color={colors.success} testID="checkout-discount">
              −{formatINR(coupon.discount)}
            </AppText>
          </View>
        ) : (
          <Pressable testID="open-coupons" onPress={openCoupons} style={styles.couponBtn}>
            <Feather name="tag" size={15} color={colors.brand} />
            <AppText variant="semibold" style={styles.couponBtnText}>
              Apply Coupon — view available offers
            </AppText>
            <Feather name="chevron-right" size={15} color={colors.muted} />
          </Pressable>
        )}
        {verified && totalBV > 0 && (
          <View style={styles.summaryRow}>
            <AppText variant="body" color={colors.onSurfaceSecondary}>
              Total BV
            </AppText>
            <AppText variant="semibold" color={colors.brand} testID="checkout-total-bv">
              {totalBV} BV
            </AppText>
          </View>
        )}
        <View style={[styles.summaryRow, { marginTop: spacing.sm }]}>
          <AppText variant="displaySemiBold" style={styles.totalText}>
            Total
          </AppText>
          <AppText variant="displaySemiBold" style={styles.totalText} testID="checkout-total">
            {formatINR(billing)}
          </AppText>
        </View>

        {!verified && (
          <View style={styles.payModeWrap}>
            <AppText variant="semibold" style={styles.payModeLabel}>
              Payment option
            </AppText>
            <Pressable
              testID="paymode-full"
              onPress={() => setPaymentMode("full")}
              style={[styles.payModeCard, paymentMode === "full" && styles.payModeCardOn]}
            >
              <Feather
                name={paymentMode === "full" ? "check-circle" : "circle"}
                size={18}
                color={paymentMode === "full" ? colors.brand : colors.muted}
              />
              <View style={{ flex: 1 }}>
                <AppText variant="semibold" style={styles.payModeTitle}>
                  Pay Full Online
                </AppText>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.payModeSub}>
                  Pay {formatINR(billing)} now via Razorpay
                </AppText>
              </View>
            </Pressable>
            <Pressable
              testID="paymode-partial"
              onPress={() => setPaymentMode("partial_cod")}
              style={[styles.payModeCard, paymentMode === "partial_cod" && styles.payModeCardOn]}
            >
              <Feather
                name={paymentMode === "partial_cod" ? "check-circle" : "circle"}
                size={18}
                color={paymentMode === "partial_cod" ? colors.brand : colors.muted}
              />
              <View style={{ flex: 1 }}>
                <AppText variant="semibold" style={styles.payModeTitle}>
                  Partial COD (30% now)
                </AppText>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.payModeSub}>
                  Pay {formatINR(onlineNow)} now, {formatINR(codDue)} cash on delivery
                </AppText>
              </View>
            </Pressable>
          </View>
        )}

        {usePartial && (
          <View style={styles.codSummary}>
            <View style={styles.summaryRow}>
              <AppText variant="body" color={colors.onSurfaceSecondary}>
                Pay now (30% advance)
              </AppText>
              <AppText variant="semibold" testID="checkout-online-now">
                {formatINR(onlineNow)}
              </AppText>
            </View>
            <View style={styles.summaryRow}>
              <AppText variant="body" color={colors.onSurfaceSecondary}>
                Cash on delivery
              </AppText>
              <AppText variant="medium" testID="checkout-cod-due">
                {formatINR(codDue)}
              </AppText>
            </View>
          </View>
        )}
      </KeyboardAwareScrollView>

      <KeyboardStickyView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="pay-button"
            label={usePartial ? `Pay 30% now · ${formatINR(onlineNow)}` : `Pay with Razorpay · ${formatINR(billing)}`}
            onPress={onPay}
            loading={submitting}
            disabled={lines.length === 0}
          />
        </View>
      </KeyboardStickyView>

      <Modal visible={couponModal} transparent animationType="fade" onRequestClose={() => setCouponModal(false)}>
        <View style={styles.couponOverlay}>
          <View style={styles.couponCard}>
            <View style={styles.couponHeader}>
              <AppText variant="displaySemiBold" style={styles.couponTitle}>
                Available Coupons
              </AppText>
              <Pressable testID="close-coupons" onPress={() => setCouponModal(false)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.onSurface} />
              </Pressable>
            </View>
            {loadingCoupons ? (
              <ActivityIndicator color={colors.brand} style={{ marginVertical: spacing.xl }} />
            ) : availableCoupons.length === 0 ? (
              <AppText variant="body" color={colors.muted} style={styles.couponEmpty}>
                No coupons available for you right now.
              </AppText>
            ) : (
              availableCoupons.map((c) => (
                <Pressable
                  key={c.id}
                  testID={`apply-coupon-${c.code}`}
                  onPress={() => c.eligible && applyCoupon(c)}
                  style={[styles.couponRow, !c.eligible && { opacity: 0.5 }]}
                >
                  <View style={{ flex: 1 }}>
                    <AppText variant="semibold" style={styles.couponCode}>
                      {c.code}
                    </AppText>
                    {!!c.description && (
                      <AppText variant="body" color={colors.muted} style={styles.couponDesc}>
                        {c.description}
                      </AppText>
                    )}
                    <AppText variant="body" color={colors.muted} style={styles.couponDesc}>
                      {c.discount_type === "percent" ? `${c.value}% OFF` : `${formatINR(c.value)} OFF`}
                      {c.min_order > 0 ? ` · Min order ${formatINR(c.min_order)}` : ""} · Valid till {c.end_date}
                    </AppText>
                    {!c.eligible && (
                      <AppText variant="body" color={colors.error} style={styles.couponDesc}>
                        Add {formatINR(c.min_order - subtotal)} more to use this coupon
                      </AppText>
                    )}
                  </View>
                  {c.eligible && (
                    <AppText variant="semibold" color={colors.brand} style={styles.couponApplyText}>
                      APPLY
                    </AppText>
                  )}
                </Pressable>
              ))
            )}
          </View>
        </View>
      </Modal>

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
  couponBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginVertical: spacing.sm,
  },
  couponBtnText: { flex: 1, fontSize: 13, color: colors.brand },
  couponApplied: { flexDirection: "row", alignItems: "center", gap: spacing.sm, flex: 1 },
  couponOverlay: {
    flex: 1,
    backgroundColor: "rgba(20,24,20,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  couponCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "80%",
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
  },
  couponHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  couponTitle: { fontSize: 18 },
  couponEmpty: { fontSize: 13, textAlign: "center", marginVertical: spacing.xl },
  couponRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  couponCode: { fontSize: 15, letterSpacing: 0.5 },
  couponDesc: { fontSize: 12, marginTop: 2 },
  couponApplyText: { fontSize: 13 },
  payModeWrap: { marginTop: spacing.xl, gap: spacing.sm },
  payModeLabel: { fontSize: 13, marginBottom: spacing.xs },
  payModeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  payModeCardOn: { borderColor: colors.brand, backgroundColor: colors.surfaceSecondary },
  payModeTitle: { fontSize: 14 },
  payModeSub: { fontSize: 12, marginTop: 2 },
  codSummary: {
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
  },
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
