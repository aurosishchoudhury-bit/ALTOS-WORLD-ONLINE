import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Switch } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

const CATEGORY_OPTIONS = ["Supplements", "Skincare", "Home Care", "Personal Care"];

export default function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [bv, setBv] = useState("");
  const [category, setCategory] = useState("Supplements");
  const [image, setImage] = useState("");
  const [stock, setStock] = useState("100");
  const [bestseller, setBestseller] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      api
        .getProduct(id)
        .then((p) => {
          setName(p.name);
          setDescription(p.description);
          setPrice(String(p.price));
          setMrp(p.mrp ? String(p.mrp) : "");
          setOfferPrice(p.offer_price ? String(p.offer_price) : "");
          setWeight(p.weight || "");
          setWeightGrams(p.weight_grams ? String(p.weight_grams) : "");
          setBv(p.bv ? String(p.bv) : "");
          setCategory(p.category);
          setImage(p.image);
          setStock(String(p.stock));
          setBestseller(!!p.bestseller);
        })
        .catch(() => toast.show("Could not load product"))
        .finally(() => setLoading(false));
    }
  }, [id, isEdit, toast]);

  const onSave = async () => {
    if (!name.trim()) return toast.show("Enter a product name");
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) return toast.show("Enter a valid selling price");
    const mrpNum = parseFloat(mrp);
    if (mrp.trim() && (isNaN(mrpNum) || mrpNum < priceNum)) {
      return toast.show("MRP must be higher than the selling price");
    }
    const offerNum = parseFloat(offerPrice);
    if (offerPrice.trim()) {
      if (isNaN(offerNum) || offerNum <= 0) return toast.show("Enter a valid offer price");
      if (!isNaN(mrpNum) && offerNum > mrpNum) {
        return toast.show("Offer price cannot be higher than MRP");
      }
    }
    const stockNum = parseInt(stock, 10);
    const gramsNum = parseFloat(weightGrams);
    if (weightGrams.trim() && (isNaN(gramsNum) || gramsNum < 0)) {
      return toast.show("Enter a valid weight in grams");
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      price: priceNum,
      mrp: isNaN(mrpNum) ? 0 : mrpNum,
      offer_price: offerPrice.trim() && !isNaN(offerNum) ? offerNum : 0,
      weight: weight.trim(),
      weight_grams: weightGrams.trim() && !isNaN(gramsNum) ? gramsNum : 0,
      bv: bv.trim() && !isNaN(parseFloat(bv)) ? parseFloat(bv) : 0,
      category: category.trim() || "Supplements",
      image: image.trim(),
      stock: isNaN(stockNum) ? 0 : stockNum,
      bestseller,
    };

    setSaving(true);
    try {
      if (isEdit && id) {
        await api.updateProduct(id, payload);
        toast.show("Product updated");
      } else {
        await api.createProduct(payload);
        toast.show("Product added");
      }
      router.back();
    } catch (e: any) {
      toast.show(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="form-close" onPress={() => router.back()} hitSlop={8}>
          <Feather name="x" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="displaySemiBold" style={styles.headerTitle}>
          {isEdit ? "Edit Product" : "Add Product"}
        </AppText>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAwareScrollView
        bottomOffset={90}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {image ? (
          <Image source={{ uri: image }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <Feather name="image" size={24} color={colors.muted} />
            <AppText variant="body" color={colors.muted} style={{ marginTop: spacing.sm }}>
              Image preview
            </AppText>
          </View>
        )}

        <FormField
          testID="form-name"
          label="Product name"
          value={name}
          onChangeText={setName}
          placeholder="Ashwagandha Root Extract"
        />
        <FormField
          testID="form-image"
          label="Image URL"
          value={image}
          onChangeText={setImage}
          placeholder="https://..."
          autoCapitalize="none"
        />

        <AppText variant="medium" color={colors.onSurfaceSecondary} style={styles.label}>
          CATEGORY
        </AppText>
        <View style={styles.chipRow}>
          {CATEGORY_OPTIONS.map((c) => {
            const active = category === c;
            return (
              <Pressable
                key={c}
                testID={`cat-${c}`}
                onPress={() => setCategory(c)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <AppText
                  variant="medium"
                  color={active ? colors.onBrand : colors.onSurface}
                  style={{ fontSize: 13 }}
                >
                  {c}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <FormField
              testID="form-price"
              label="Selling price (DP ₹)"
              value={price}
              onChangeText={setPrice}
              placeholder="499"
              keyboardType="decimal-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              testID="form-mrp"
              label="MRP (₹)"
              value={mrp}
              onChangeText={setMrp}
              placeholder="699"
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <FormField
          testID="form-offer-price"
          label="Selling price for non-Altos customers (₹, optional)"
          value={offerPrice}
          onChangeText={setOfferPrice}
          placeholder="Leave empty to charge MRP"
          keyboardType="decimal-pad"
        />
        <AppText variant="body" color={colors.muted} style={styles.hint}>
          DP price is shown only to verified Altos ID holders. Non-Altos customers see MRP, or
          this selling price with a discount badge when set.
        </AppText>

        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <FormField
              testID="form-weight"
              label="Weight / Size"
              value={weight}
              onChangeText={setWeight}
              placeholder="60 capsules"
              autoCapitalize="none"
            />
          </View>
          <View style={{ flex: 1 }}>
            <FormField
              testID="form-stock"
              label="Stock"
              value={stock}
              onChangeText={setStock}
              placeholder="100"
              keyboardType="number-pad"
            />
          </View>
        </View>

        <FormField
          testID="form-weight-grams"
          label="Weight in grams (for shipping)"
          value={weightGrams}
          onChangeText={setWeightGrams}
          placeholder="e.g. 250"
          keyboardType="decimal-pad"
        />
        <FormField
          testID="form-bv"
          label="BV — Business Volume (for Altos ID holders)"
          value={bv}
          onChangeText={setBv}
          placeholder="e.g. 30"
          keyboardType="decimal-pad"
        />
        <AppText variant="body" color={colors.muted} style={styles.hint}>
          Used to calculate shipping: free up to 3 kg, ₹50 above 3 kg, ₹100 above 5 kg. Items of
          500 g or more are limited to 2 pcs per order.
        </AppText>

        <FormField
          testID="form-description"
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Short product description..."
          multiline
          numberOfLines={4}
          style={styles.descInput}
        />

        <Pressable
          testID="form-bestseller"
          onPress={() => setBestseller((v) => !v)}
          style={styles.bestsellerRow}
        >
          <View style={{ flex: 1 }}>
            <AppText variant="semibold" style={styles.bestsellerLabel}>
              Bestseller
            </AppText>
            <AppText variant="body" color={colors.muted} style={styles.bestsellerHint}>
              Feature this product in the Bestsellers row on the home screen
            </AppText>
          </View>
          <Switch
            value={bestseller}
            onValueChange={setBestseller}
            trackColor={{ false: colors.border, true: colors.brand }}
            thumbColor={colors.surface}
          />
        </Pressable>
      </KeyboardAwareScrollView>

      <KeyboardStickyView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
          <Button
            testID="save-product-button"
            label={isEdit ? "Save Changes" : "Add Product"}
            onPress={onSave}
            loading={saving}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  bestsellerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  bestsellerLabel: { fontSize: 14 },
  bestsellerHint: { fontSize: 12, marginTop: 2 },
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
  preview: {
    width: "100%",
    height: 180,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.xl,
  },
  previewEmpty: { alignItems: "center", justifyContent: "center" },
  label: {
    fontSize: 12,
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  chipRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  chip: {
    height: 40,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  priceRow: { flexDirection: "row", gap: spacing.lg },
  descInput: { minHeight: 110, textAlignVertical: "top" },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
