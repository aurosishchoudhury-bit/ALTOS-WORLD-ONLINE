import React, { useEffect, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Switch, Platform, Linking, Modal, ScrollView, TextInput } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api, API, resolveImageUri } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

const CATEGORY_OPTIONS = ["Supplements", "Skincare", "Hair Care", "Home Care", "Personal Care", "Agriculture/Veterinary"];
const MAX_IMAGES = 6;

export default function ProductForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadPicked = async (asset: ImagePicker.ImagePickerAsset): Promise<string | null> => {
    try {
      const name = asset.fileName || `photo_${Date.now()}.jpg`;
      const type = asset.mimeType || "image/jpeg";
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(asset.uri)).blob();
        form.append("file", blob, name);
      } else {
        form.append("file", { uri: asset.uri, name, type } as any);
      }
      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || "Upload failed");
      }
      const data = await res.json();
      return data.image_url;
    } catch (e: any) {
      toast.show(e?.message || "Could not upload image");
      return null;
    }
  };

  const pickFromGallery = async () => {
    if (images.length >= MAX_IMAGES) {
      return toast.show(`Maximum ${MAX_IMAGES} images per product`);
    }
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain || perm.status === "undetermined") {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!req.granted) {
          toast.show("Gallery access is needed to pick product photos");
          return;
        }
      } else {
        toast.show("Gallery access denied — enable it in Settings");
        Linking.openSettings().catch(() => {});
        return;
      }
    }
    const remaining = MAX_IMAGES - images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const asset of result.assets.slice(0, remaining)) {
      const url = await uploadPicked(asset);
      if (url) urls.push(url);
    }
    if (urls.length) {
      setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
      toast.show(`${urls.length} image(s) uploaded`);
    }
    setUploading(false);
  };
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [discountPct, setDiscountPct] = useState("");
  const [weight, setWeight] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [dosage, setDosage] = useState("");
  const [bv, setBv] = useState("");
  const [category, setCategory] = useState("Supplements");
  const [image, setImage] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [stock, setStock] = useState("100");
  const [bestseller, setBestseller] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(0);
  const [ingredients, setIngredients] = useState("");
  const [benefits, setBenefits] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<string[]>(CATEGORY_OPTIONS);
  const [catOpen, setCatOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [addingCat, setAddingCat] = useState(false);

  useEffect(() => {
    api.categories().then((c) => c.length && setCategoryOptions(c)).catch(() => {});
  }, []);

  const addCategory = async () => {
    const nameToAdd = newCat.trim();
    if (nameToAdd.length < 2) {
      toast.show("Enter a category name");
      return;
    }
    setAddingCat(true);
    try {
      await api.addCategory(nameToAdd);
      setCategoryOptions((prev) => [...new Set([...prev, nameToAdd])].sort());
      setCategory(nameToAdd);
      setNewCat("");
      setCatOpen(false);
      toast.show(`Category "${nameToAdd}" added`);
    } catch (e: any) {
      toast.show(e?.message || "Could not add category");
    } finally {
      setAddingCat(false);
    }
  };

  const runAiImages = (
    baseImage: string,
    productName: string,
    pageUrl: string,
    ing: string,
    ben: string,
  ) => {
    setAiGenerating(3);
    (["lifestyle", "ingredients", "benefits"] as const).forEach((variant) => {
      api
        .generateAiImage({
          variant,
          image_url: baseImage,
          product_name: productName,
          url: pageUrl,
          ingredients: ing,
          benefits: ben,
        })
        .then((r) => {
          setImages((prev) => (prev.includes(r.image_url) || prev.length >= MAX_IMAGES ? prev : [...prev, r.image_url]));
          const label =
            variant === "lifestyle" ? "AI ecommerce image added" : variant === "ingredients" ? "AI ingredients image added" : "AI benefits image added";
          toast.show(label);
        })
        .catch(() => toast.show(`AI ${variant} image failed — tap Regenerate to retry`))
        .finally(() => setAiGenerating((n) => n - 1));
    });
  };

  const regenerateAi = () => {
    const base = images.find((i) => !i.includes("/ai-") && !i.includes("label-fssai")) || images[0];
    if (!base) {
      toast.show("Add or import a product image first");
      return;
    }
    // drop previous AI images so fresh ones replace them
    setImages((prev) => prev.filter((i) => !i.includes("/uploads/products/ai-")));
    runAiImages(base, name.trim(), importUrl.trim(), ingredients.trim(), benefits.trim());
  };

  const runImport = async () => {
    if (!importUrl.trim().includes("altosindia.net")) {
      toast.show("Paste a product link from altosindia.net");
      return;
    }
    setImporting(true);
    try {
      const d = await api.importProductUrl(importUrl.trim());
      if (d.name) setName(d.name);
      if (d.description) setDescription(d.description);
      if (d.weight) setWeight(d.weight);
      if (d.weight_grams) setWeightGrams(String(d.weight_grams));
      if (d.dosage) setDosage(d.dosage);
      if (d.mrp) setMrp(String(d.mrp));
      if (d.ingredients) setIngredients(d.ingredients);
      if (d.benefits) setBenefits(d.benefits);
      if (d.images?.length) {
        setImages(d.images);
        runAiImages(d.images[0], d.name || "", importUrl.trim(), d.ingredients || "", d.benefits || "");
        toast.show("Details imported — generating 3 AI images…");
      } else {
        toast.show("Product details imported — review & set prices");
      }
    } catch (e: any) {
      toast.show(e?.message || "Could not import from that link");
    } finally {
      setImporting(false);
    }
  };

  useEffect(() => {
    if (isEdit && id) {
      api
        .getProduct(id)
        .then((p) => {
          setName(p.name);
          setDescription(p.description);
          setPrice(String(p.price));
          setMrp(p.mrp ? String(p.mrp) : "");
          setDiscountPct(
            p.offer_price && p.mrp
              ? String(Math.round((1 - p.offer_price / p.mrp) * 100))
              : "",
          );
          setWeight(p.weight || "");
          setWeightGrams(p.weight_grams ? String(p.weight_grams) : "");
          setDosage((p as any).dosage || "");
          setIngredients((p as any).ingredients || "");
          setBenefits((p as any).benefits || "");
          setBv(p.bv ? String(p.bv) : "");
          setCategory(p.category);
          setImage(p.image);
          setImages(p.images?.length ? p.images : p.image ? [p.image] : []);
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
    const pctNum = parseFloat(discountPct);
    let computedOffer = 0;
    if (discountPct.trim()) {
      if (isNaN(pctNum) || pctNum < 0 || pctNum >= 100) {
        return toast.show("Discount % must be between 0 and 99");
      }
      if (isNaN(mrpNum) || mrpNum <= 0) {
        return toast.show("Enter the MRP first to apply a % discount");
      }
      computedOffer = Math.round(mrpNum * (1 - pctNum / 100));
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
      offer_price: computedOffer,
      weight: weight.trim(),
      weight_grams: weightGrams.trim() && !isNaN(gramsNum) ? gramsNum : 0,
      dosage: dosage.trim(),
      ingredients: ingredients.trim(),
      benefits: benefits.trim(),
      bv: bv.trim() && !isNaN(parseFloat(bv)) ? parseFloat(bv) : 0,
      category: category.trim() || "Supplements",
      image: images[0] || image.trim(),
      images: images.length ? images : image.trim() ? [image.trim()] : [],
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
        <View style={styles.importCard} testID="import-card">
          <View style={styles.importHead}>
            <Feather name="link" size={15} color={colors.brand} />
            <AppText variant="semibold" style={styles.importTitle}>
              Auto-fill from Altos website
            </AppText>
          </View>
          <FormField
            testID="import-url"
            label="Paste product link (altosindia.net)"
            value={importUrl}
            onChangeText={setImportUrl}
            autoCapitalize="none"
            placeholder="https://shop.altosindia.net/eshop/product/info/…"
          />
          <Button
            testID="import-button"
            label={importing ? "Importing…" : "Auto-fill product details"}
            variant="secondary"
            onPress={runImport}
            loading={importing}
          />
        </View>

        {aiGenerating > 0 && (
          <View style={styles.aiBanner} testID="ai-generating-banner">
            <ActivityIndicator size="small" color={colors.brand} />
            <AppText variant="semibold" style={styles.aiBannerText}>
              Generating {aiGenerating} AI image{aiGenerating > 1 ? "s" : ""} (ecommerce shot +
              ingredients + benefits)… they&apos;ll be added below automatically
            </AppText>
          </View>
        )}

        {images.length > 0 && aiGenerating === 0 && (
          <Pressable testID="regenerate-ai" onPress={regenerateAi} style={styles.regenBtn}>
            <Feather name="refresh-cw" size={14} color={colors.brand} />
            <AppText variant="semibold" style={styles.regenText}>
              Regenerate AI images (fresh look)
            </AppText>
          </Pressable>
        )}

        {images.length > 0 ? (
          <View style={styles.thumbRow}>
            {images.map((img, i) => (
              <View key={img + i} style={styles.thumbWrap}>
                <Image source={{ uri: resolveImageUri(img) }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  testID={`remove-image-${i}`}
                  onPress={() => setImages((prev) => prev.filter((_, x) => x !== i))}
                  style={styles.thumbRemove}
                >
                  <Feather name="x" size={12} color="#FFFFFF" />
                </Pressable>
                {i === 0 && (
                  <View style={styles.mainTag}>
                    <AppText variant="semibold" color={colors.onBrand} style={styles.mainTagText}>
                      Main
                    </AppText>
                  </View>
                )}
              </View>
            ))}
          </View>
        ) : image ? (
          <Image source={{ uri: resolveImageUri(image) }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={[styles.preview, styles.previewEmpty]}>
            <Feather name="image" size={24} color={colors.muted} />
            <AppText variant="body" color={colors.muted} style={{ marginTop: spacing.sm }}>
              Image preview
            </AppText>
          </View>
        )}

        <Pressable
          testID="pick-gallery-button"
          onPress={pickFromGallery}
          disabled={uploading}
          style={styles.galleryBtn}
        >
          {uploading ? (
            <ActivityIndicator color={colors.brand} size="small" />
          ) : (
            <Feather name="image" size={17} color={colors.brand} />
          )}
          <AppText variant="semibold" color={colors.brand} style={styles.galleryBtnText}>
            {uploading ? "Uploading…" : `Add images from gallery (${images.length}/${MAX_IMAGES})`}
          </AppText>
        </Pressable>

        <FormField
          testID="form-name"
          label="Product name"
          value={name}
          onChangeText={setName}
          placeholder="Ashwagandha Root Extract"
        />
        <FormField
          testID="form-image"
          label="Image URL (or use gallery above)"
          value={image}
          onChangeText={setImage}
          placeholder="https://..."
          autoCapitalize="none"
        />

        <AppText variant="medium" color={colors.onSurfaceSecondary} style={styles.label}>
          CATEGORY
        </AppText>
        <Pressable testID="category-dropdown" onPress={() => setCatOpen(true)} style={styles.catDropdown}>
          <AppText variant="medium" style={{ fontSize: 14 }}>
            {category}
          </AppText>
          <Feather name="chevron-down" size={16} color={colors.muted} />
        </Pressable>

        <Modal visible={catOpen} transparent animationType="fade" onRequestClose={() => setCatOpen(false)}>
          <Pressable style={styles.catOverlay} onPress={() => setCatOpen(false)}>
            <Pressable style={styles.catCard} onPress={() => {}}>
              <AppText variant="semibold" style={styles.catTitle}>
                Select category
              </AppText>
              <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                {categoryOptions.map((c) => (
                  <Pressable
                    key={c}
                    testID={`cat-${c}`}
                    onPress={() => {
                      setCategory(c);
                      setCatOpen(false);
                    }}
                    style={styles.catRow}
                  >
                    <AppText
                      variant={c === category ? "semibold" : "body"}
                      color={c === category ? colors.brand : colors.onSurface}
                    >
                      {c}
                    </AppText>
                    {c === category && <Feather name="check" size={16} color={colors.brand} />}
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.addCatRow}>
                <TextInput
                  testID="new-category-input"
                  value={newCat}
                  onChangeText={setNewCat}
                  placeholder="New category name"
                  placeholderTextColor={colors.muted}
                  style={styles.addCatInput}
                />
                <Pressable testID="add-category" onPress={addCategory} style={styles.addCatBtn} disabled={addingCat}>
                  <AppText variant="semibold" color={colors.onBrand} style={{ fontSize: 13 }}>
                    {addingCat ? "…" : "Add"}
                  </AppText>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

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
          testID="form-discount-pct"
          label="Discount % off MRP for non-Altos customers (optional)"
          value={discountPct}
          onChangeText={setDiscountPct}
          placeholder="e.g. 10 (leave empty to charge MRP)"
          keyboardType="decimal-pad"
        />
        {!!discountPct.trim() && !isNaN(parseFloat(discountPct)) && !isNaN(parseFloat(mrp)) && parseFloat(mrp) > 0 && (
          <AppText variant="semibold" color={colors.brand} style={styles.hint} testID="offer-preview">
            Selling price: ₹{Math.round(parseFloat(mrp) * (1 - parseFloat(discountPct) / 100))} (MRP ₹
            {parseFloat(mrp)} − {discountPct}%)
          </AppText>
        )}
        <AppText variant="body" color={colors.muted} style={styles.hint}>
          DP price is shown only to verified Altos ID holders. Non-Altos customers see MRP, or the
          discounted selling price with a discount badge when a % is set.
        </AppText>

        {!isNaN(parseFloat(price)) && parseFloat(price) > 0 && !isNaN(parseFloat(mrp)) && parseFloat(mrp) > 0 && (() => {
          const dp = parseFloat(price);
          const mrpNum = parseFloat(mrp);
          const buying = Math.round(dp * 0.88 * 100) / 100;
          const profit = Math.round((mrpNum - buying) * 100) / 100;
          const profitPct = Math.round((profit / mrpNum) * 1000) / 10;
          return (
            <View style={styles.profitCard} testID="profit-on-mrp">
              <AppText variant="semibold" style={styles.profitTitle}>
                Profit on MRP
              </AppText>
              <View style={styles.profitRow}>
                <AppText variant="body" color={colors.onSurfaceSecondary}>
                  Buying price (DP − 12%)
                </AppText>
                <AppText variant="medium">₹{buying}</AppText>
              </View>
              <View style={styles.profitRow}>
                <AppText variant="body" color={colors.onSurfaceSecondary}>
                  Profit at MRP ₹{mrpNum}
                </AppText>
                <AppText variant="semibold" color={colors.success}>
                  ₹{profit} ({profitPct}%)
                </AppText>
              </View>
            </View>
          );
        })()}

        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <FormField
              testID="form-weight"
              label="Packing (weight / size)"
              value={weight}
              onChangeText={setWeight}
              placeholder="100 ml / 60 capsules"
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
          testID="form-dosage"
          label="Dosage (shown on product page)"
          value={dosage}
          onChangeText={setDosage}
          placeholder="e.g. 1 capsule twice daily after meals"
        />
        <FormField
          testID="form-ingredients"
          label="Ingredients"
          value={ingredients}
          onChangeText={setIngredients}
          placeholder="e.g. Haldi, Kesar, Curcumin"
          multiline
          numberOfLines={3}
          style={styles.multilineInput}
        />
        <FormField
          testID="form-benefits"
          label="Benefits"
          value={benefits}
          onChangeText={setBenefits}
          placeholder="Key health benefits of this product"
          multiline
          numberOfLines={4}
          style={styles.multilineInput}
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
  galleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 46,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  galleryBtnText: { fontSize: 14 },
  importCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  importHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  importTitle: { fontSize: 14 },
  thumbRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  aiBannerText: { flex: 1, fontSize: 12, lineHeight: 17, color: colors.brand },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brand,
    borderRadius: radius.md,
    minHeight: 44,
    marginBottom: spacing.md,
  },
  regenText: { fontSize: 13, color: colors.brand },
  multilineInput: { minHeight: 76, textAlignVertical: "top" },
  catDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    marginBottom: spacing.md,
  },
  catOverlay: {
    flex: 1,
    backgroundColor: "rgba(20,24,20,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  catCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  catTitle: { fontSize: 15, marginBottom: spacing.sm },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  addCatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  addCatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    fontSize: 14,
    color: colors.onSurface,
  },
  addCatBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbWrap: {
    width: 74,
    height: 74,
  },
  thumb: {
    width: 74,
    height: 74,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  thumbRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(20,24,20,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  mainTag: {
    position: "absolute",
    bottom: 4,
    left: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  mainTagText: { fontSize: 8, letterSpacing: 0.3 },
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
  profitCard: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  profitTitle: { fontSize: 13, marginBottom: spacing.sm },
  profitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 2,
  },
  descInput: { minHeight: 110, textAlignVertical: "top" },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
