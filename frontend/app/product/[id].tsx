import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import QuantityStepper from "@/src/components/QuantityStepper";
import Stars from "@/src/components/Stars";
import FormField from "@/src/components/FormField";
import { useCart } from "@/src/context/CartContext";
import { useToast } from "@/src/components/Toast";
import { api, Product, resolveImageUri } from "@/src/api/client";
import { colors, spacing, radius, formatINR } from "@/src/theme/theme";
import { useAltosAuth } from "@/src/context/AltosAuthContext";
import { getPriceInfo, discountPercent, maxQtyFor, isHeavyItem } from "@/src/utils/pricing";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const { verified } = useAltosAuth();
  const toast = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [qty, setQty] = useState(1);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const { width: winWidth } = useWindowDimensions();

  const [reviews, setReviews] = useState<any[]>([]);
  const [ratingAvg, setRatingAvg] = useState(0);
  const [ratingCount, setRatingCount] = useState(0);
  const [revName, setRevName] = useState("");
  const [revRating, setRevRating] = useState(0);
  const [revComment, setRevComment] = useState("");
  const [revPhone, setRevPhone] = useState("");
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [shipText, setShipText] = useState("Free up to 3 kg · ₹50 for 3–5 kg · ₹100 above 5 kg.");

  useEffect(() => {
    api.getSettings().then((s) => {
      if (s.shipping_mode === "flat") {
        const free = Number(s.free_above_amount) > 0 ? ` Free above ₹${s.free_above_amount}.` : "";
        setShipText(`Flat ₹${s.flat_charge} shipping.${free}`);
      } else {
        const kg = (g: number) => `${(Number(g) / 1000).toString()} kg`;
        setShipText(
          `Free up to ${kg(s.free_upto_grams)} · ₹${s.mid_charge} for ${kg(s.free_upto_grams)}–${kg(s.mid_upto_grams)} · ₹${s.high_charge} above ${kg(s.mid_upto_grams)}.`,
        );
      }
    }).catch(() => {});
  }, []);

  const loadReviews = async (pid: string) => {
    try {
      const data = await api.getReviews(pid);
      setReviews(data.reviews);
      setRatingAvg(data.rating_avg);
      setRatingCount(data.rating_count);
    } catch {
      // non-blocking
    }
  };

  const submitReview = async () => {
    if (!product) return;
    if (!revName.trim()) return toast.show("Please enter your name");
    if (revRating < 1) return toast.show("Please select a star rating");
    if (!verified && revPhone.trim().length < 10)
      return toast.show("Enter the mobile number you used to purchase");
    setRevSubmitting(true);
    try {
      await api.addReview(product.id, {
        name: revName.trim(),
        rating: revRating,
        comment: revComment.trim(),
        altos_verified: verified,
        phone: revPhone.trim(),
      });
      setRevName("");
      setRevRating(0);
      setRevComment("");
      setRevPhone("");
      toast.show("Thanks for your review!");
      await loadReviews(product.id);
    } catch (e: any) {
      toast.show(e?.message || "Could not submit review");
    } finally {
      setRevSubmitting(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const p = await api.getProduct(id);
        setProduct(p);
        loadReviews(id);
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
  const priceInfo = getPriceInfo(product, verified);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View style={[styles.imageWrap, { width: winWidth, height: winWidth * 1.1 }]}>
          {(() => {
            const gallery =
              product.images && product.images.length > 0 ? product.images : [product.image];
            if (gallery.length === 1) {
              return (
                <Pressable testID="open-image-viewer" onPress={() => setViewerOpen(true)} style={styles.image}>
                  <Image
                    source={{ uri: resolveImageUri(gallery[0]) }}
                    style={styles.image}
                    contentFit="cover"
                  />
                </Pressable>
              );
            }
            return (
              <>
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(e) =>
                    setGalleryIndex(Math.round(e.nativeEvent.contentOffset.x / winWidth))
                  }
                  testID="product-gallery"
                >
                  {gallery.map((img, i) => (
                    <Pressable
                      key={img + i}
                      testID={i === 0 ? "open-image-viewer" : undefined}
                      onPress={() => setViewerOpen(true)}
                    >
                      <Image
                        source={{ uri: resolveImageUri(img) }}
                        style={[styles.image, { width: winWidth }]}
                        contentFit="cover"
                      />
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.galleryDots}>
                  {gallery.map((img, i) => (
                    <View
                      key={`d${i}`}
                      style={[styles.galleryDot, i === galleryIndex && styles.galleryDotActive]}
                    />
                  ))}
                </View>
              </>
            );
          })()}
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
            {product.weight ? `${product.category} · ${product.weight}` : product.category}
          </AppText>
          <AppText variant="display" style={styles.title}>
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
                <View style={styles.discountPill}>
                  <AppText variant="semibold" color={colors.onBrand} style={styles.discountText}>
                    {discountPercent(priceInfo)}% OFF
                  </AppText>
                </View>
              </>
            )}
          </View>
          {product.mrp > 0 && (
            <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.packingLine}>
              Packing: {product.weight || "-"} · MRP {formatINR(product.mrp)}
            </AppText>
          )}
          {verified && (
            <AppText variant="body" color={colors.success} style={styles.dpNote}>
              Altos ID holder DP price applied
              {Number(product.bv) > 0 ? ` · BV ${Number(product.bv)} per unit` : ""}
            </AppText>
          )}

          <View style={styles.divider} />

          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.description}>
            {product.description}
          </AppText>

          <View style={styles.divider} />

          {!!product.dosage && (
            <>
              <View style={styles.dosageBox} testID="dosage-box">
                <View style={styles.dosageHeader}>
                  <Feather name="clock" size={15} color={colors.brand} />
                  <AppText variant="semibold" style={styles.dosageTitle}>
                    Dosage
                  </AppText>
                </View>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.dosageText}>
                  {product.dosage}
                </AppText>
              </View>
              <View style={styles.divider} />
            </>
          )}

          {!!(product as any).ingredients && (
            <>
              <View style={styles.dosageBox} testID="ingredients-box">
                <View style={styles.dosageHeader}>
                  <Feather name="feather" size={15} color={colors.brand} />
                  <AppText variant="semibold" style={styles.dosageTitle}>
                    Ingredients
                  </AppText>
                </View>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.dosageText}>
                  {(product as any).ingredients}
                </AppText>
              </View>
              <View style={styles.divider} />
            </>
          )}

          {!!(product as any).benefits && (
            <>
              <View style={styles.dosageBox} testID="benefits-box">
                <View style={styles.dosageHeader}>
                  <Feather name="heart" size={15} color={colors.brand} />
                  <AppText variant="semibold" style={styles.dosageTitle}>
                    Benefits
                  </AppText>
                </View>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.dosageText}>
                  {(product as any).benefits}
                </AppText>
              </View>
              <View style={styles.divider} />
            </>
          )}

          <View style={styles.infoCard} testID="shipping-info">
            <View style={styles.infoRow}>
              <Feather name="truck" size={16} color={colors.brand} />
              <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.infoText}>
                Usually dispatched within 2 days and delivered within 7–10 days.
              </AppText>
            </View>
            <View style={styles.infoRow}>
              <Feather name="package" size={16} color={colors.brand} />
              <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.infoText}>
                Shipping: {shipText}
              </AppText>
            </View>
            {!verified && (
              <View style={styles.infoRow}>
                <Feather name="credit-card" size={16} color={colors.brand} />
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.infoText}>
                  Partial COD available — pay 30% now, rest on delivery (non-Altos ID users).
                </AppText>
              </View>
            )}
          </View>

          <View style={styles.divider} />

          {product.category === "Supplements" && (
            <>
              <View style={styles.disclaimerBox} testID="ayurvedic-disclaimer">
                <View style={styles.dosageHeader}>
                  <Feather name="alert-circle" size={15} color="#8A6D00" />
                  <AppText variant="semibold" style={styles.disclaimerTitle}>
                    Disclaimer
                  </AppText>
                </View>
                <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.disclaimerText}>
                  These ayurvedic formulations are for general wellness. These products are not
                  intended to diagnose, treat or cure any disease. Always consult with a qualified
                  healthcare provider before using any herbal or ayurvedic products, especially if
                  you are:{"\n"}• Pregnant or nursing{"\n"}• Currently taking prescription
                  medications{"\n"}• Planning to have surgery{"\n"}• Dealing with an existing
                  medical condition
                </AppText>
              </View>
              <View style={styles.divider} />
            </>
          )}

          <View style={styles.reviewsHeader} testID="reviews-section">
            <AppText variant="displaySemiBold" style={styles.reviewsTitle}>
              Ratings & Reviews
            </AppText>
            {ratingCount > 0 && (
              <View style={styles.ratingSummary}>
                <Stars value={ratingAvg} size={15} />
                <AppText variant="semibold" style={styles.ratingAvgText}>
                  {ratingAvg}
                </AppText>
                <AppText variant="body" color={colors.muted} style={styles.ratingCountText}>
                  ({ratingCount} review{ratingCount === 1 ? "" : "s"})
                </AppText>
              </View>
            )}
          </View>

          {reviews.length === 0 ? (
            <AppText variant="body" color={colors.muted} style={styles.noReviews}>
              No reviews yet — be the first to review this product.
            </AppText>
          ) : (
            reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTop}>
                  <AppText variant="semibold" style={styles.reviewName}>
                    {r.name}
                  </AppText>
                  <Stars value={r.rating} size={12} />
                </View>
                {!!r.comment && (
                  <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.reviewComment}>
                    {r.comment}
                  </AppText>
                )}
                <AppText variant="body" color={colors.muted} style={styles.reviewDate}>
                  {new Date(r.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </AppText>
              </View>
            ))
          )}

          <View style={styles.writeReview}>
            <AppText variant="semibold" style={styles.writeTitle}>
              Write a review
            </AppText>
            <AppText variant="body" color={colors.muted} style={styles.reviewNote}>
              {verified
                ? "Reviewing as a verified Altos ID holder."
                : "Reviews are open to Altos ID holders and customers who purchased this product."}
            </AppText>
            <View style={styles.starInputRow}>
              <Stars value={revRating} size={26} onChange={setRevRating} />
            </View>
            <FormField
              testID="review-name"
              label="Your name"
              value={revName}
              onChangeText={setRevName}
              placeholder="e.g. Priya"
            />
            {!verified && (
              <FormField
                testID="review-phone"
                label="Mobile number used at purchase"
                value={revPhone}
                onChangeText={setRevPhone}
                placeholder="10-digit mobile"
                keyboardType="phone-pad"
              />
            )}
            <FormField
              testID="review-comment"
              label="Your review (optional)"
              value={revComment}
              onChangeText={setRevComment}
              placeholder="How was the product?"
              multiline
              numberOfLines={3}
            />
            <Button
              testID="submit-review"
              label="Submit Review"
              variant="secondary"
              onPress={submitReview}
              loading={revSubmitting}
            />
          </View>

          <View style={styles.qtyRow}>
            <AppText variant="semibold" style={styles.qtyLabel}>
              Quantity
            </AppText>
            <QuantityStepper
              value={qty}
              onChange={(v) => setQty(Math.max(1, v))}
              min={1}
              max={maxQtyFor(product)}
            />
          </View>
          {isHeavyItem(product) && (
            <AppText variant="body" color={colors.warning} style={styles.limitNote}>
              Max 2 pcs per order (item weighs 500g or more)
            </AppText>
          )}

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
          label={outOfStock ? "Out of stock" : `Add to Cart · ${formatINR(priceInfo.unit * qty)}`}
          onPress={onAdd}
          disabled={outOfStock}
        />
      </View>

      <Modal
        visible={viewerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerOpen(false)}
      >
        <View style={styles.viewerOverlay}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: galleryIndex * winWidth, y: 0 }}
          >
            {(product.images && product.images.length > 0 ? product.images : [product.image]).map(
              (img, i) => (
                <Pressable
                  key={`v${i}`}
                  style={[styles.viewerPage, { width: winWidth }]}
                  onPress={() => setViewerOpen(false)}
                >
                  <Image
                    source={{ uri: resolveImageUri(img) }}
                    style={styles.viewerImage}
                    contentFit="contain"
                  />
                </Pressable>
              ),
            )}
          </ScrollView>
          <Pressable
            testID="close-image-viewer"
            onPress={() => setViewerOpen(false)}
            style={[styles.viewerClose, { top: insets.top + spacing.md }]}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </Modal>
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
    backgroundColor: colors.surfaceSecondary,
  },
  image: { width: "100%", height: "100%" },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,12,10,0.96)",
  },
  viewerPage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "80%",
  },
  viewerClose: {
    position: "absolute",
    right: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  galleryDots: {
    position: "absolute",
    bottom: 14,
    alignSelf: "center",
    flexDirection: "row",
    gap: 5,
  },
  galleryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
  galleryDotActive: {
    backgroundColor: "#FFFFFF",
    width: 14,
  },
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
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  mrp: {
    fontSize: 15,
    textDecorationLine: "line-through",
  },
  discountPill: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: 999,
  },
  discountText: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  dpNote: {
    fontSize: 12,
    marginTop: spacing.sm,
  },
  packingLine: {
    fontSize: 13,
    marginTop: spacing.sm,
  },
  infoCard: {
    gap: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  infoText: { flex: 1, fontSize: 13, lineHeight: 19 },
  dosageBox: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: spacing.lg,
  },
  dosageHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dosageTitle: { fontSize: 14 },
  dosageText: { fontSize: 13, lineHeight: 20, marginTop: spacing.sm },
  disclaimerBox: {
    backgroundColor: "#FFF9EA",
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  disclaimerTitle: { fontSize: 14, color: "#8A6D00" },
  disclaimerText: { fontSize: 12.5, lineHeight: 20, marginTop: spacing.sm },
  reviewsHeader: {
    marginTop: spacing.md,
  },
  reviewsTitle: { fontSize: 20 },
  ratingSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  ratingAvgText: { fontSize: 14 },
  ratingCountText: { fontSize: 13 },
  noReviews: { fontSize: 13, marginTop: spacing.md },
  reviewCard: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surfaceSecondary,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  reviewName: { fontSize: 14 },
  reviewComment: { fontSize: 13, lineHeight: 19, marginTop: spacing.xs },
  reviewDate: { fontSize: 11, marginTop: spacing.sm },
  writeReview: {
    marginTop: spacing.xl,
  },
  writeTitle: { fontSize: 15, marginBottom: spacing.sm },
  reviewNote: { fontSize: 12, lineHeight: 17, marginBottom: spacing.sm },
  starInputRow: {
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
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
  limitNote: { fontSize: 12, marginTop: spacing.sm },
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
