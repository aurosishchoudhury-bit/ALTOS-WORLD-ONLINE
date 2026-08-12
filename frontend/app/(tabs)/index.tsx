import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import AppText from "@/src/components/AppText";
import ProductCard from "@/src/components/ProductCard";
import { useToast } from "@/src/components/Toast";
import { useCart } from "@/src/context/CartContext";
import { api, Product } from "@/src/api/client";
import { colors, spacing, radius, fonts } from "@/src/theme/theme";

const { width } = Dimensions.get("window");
const HERO = "https://images.unsplash.com/photo-1526235591527-15084c256bad";
const LOGO = require("../../assets/images/altos-logo.jpg");

export default function Storefront() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [active, setActive] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(async (category: string) => {
    try {
      setError(false);
      const [prods, cats] = await Promise.all([
        api.listProducts(category),
        api.categories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(active);
  }, [active, load]);

  const onSelectCategory = (cat: string) => {
    Haptics.selectionAsync().catch(() => {});
    setLoading(true);
    setActive(cat);
  };

  const onAdd = (p: Product) => {
    addItem(p, 1);
    toast.show(`${p.name} added to cart`);
  };

  const chips = ["All", ...categories];

  const query = search.trim().toLowerCase();
  const visible = query
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      )
    : products;

  const Header = (
    <View>
      <View style={[styles.logoBar, { paddingTop: insets.top + spacing.md }]}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
      </View>
      <View style={styles.hero}>
        <Image source={{ uri: HERO }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient
          colors={["rgba(42,47,42,0.15)", "rgba(42,47,42,0.75)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroContent}>
          <AppText variant="body" color={colors.onSurfaceInverse} style={styles.heroKicker}>
            WELLNESS · HERBAL · SKINCARE
          </AppText>
          <AppText variant="display" color={colors.onSurfaceInverse} style={styles.heroTitle}>
            Rooted in Nature
          </AppText>
          <AppText variant="body" color={colors.onSurfaceInverse} style={styles.heroSub}>
            Pure, plant-powered wellness delivered to your door.
          </AppText>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.muted} />
          <TextInput
            testID="search-input"
            value={search}
            onChangeText={setSearch}
            placeholder="Search products"
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable testID="search-clear" onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipRow}
        contentContainerStyle={styles.chipRowContent}
      >
        {chips.map((cat) => {
          const isActive = cat === active;
          return (
            <Pressable
              key={cat}
              testID={`category-chip-${cat}`}
              onPress={() => onSelectCategory(cat)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              <AppText
                variant="medium"
                color={isActive ? colors.onBrand : colors.onSurface}
                style={styles.chipText}
              >
                {cat}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={Header}
        keyboardShouldPersistTaps="handled"
        columnWrapperStyle={styles.columnWrap}
        contentContainerStyle={{ paddingBottom: spacing["3xl"] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(active);
            }}
            tintColor={colors.brand}
          />
        }
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/product/${item.id}`)}
            onAdd={() => onAdd(item)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.center}>
            {error ? (
              <>
                <Feather name="cloud-off" size={28} color={colors.muted} />
                <AppText variant="displayMedium" style={styles.emptyTitle}>
                  Unable to load catalog
                </AppText>
                <Pressable onPress={() => load(active)} testID="retry-button">
                  <AppText variant="semibold" color={colors.brand}>
                    Tap to retry
                  </AppText>
                </Pressable>
              </>
            ) : query ? (
              <>
                <Feather name="search" size={28} color={colors.muted} />
                <AppText variant="displayMedium" style={styles.emptyTitle}>
                  No results for &ldquo;{search.trim()}&rdquo;
                </AppText>
                <Pressable onPress={() => setSearch("")} testID="clear-search-empty">
                  <AppText variant="semibold" color={colors.brand}>
                    Clear search
                  </AppText>
                </Pressable>
              </>
            ) : (
              <>
                <Feather name="feather" size={28} color={colors.muted} />
                <AppText variant="displayMedium" style={styles.emptyTitle}>
                  No products available
                </AppText>
              </>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: {
    paddingVertical: spacing["3xl"],
    alignItems: "center",
    gap: spacing.md,
  },
  logoBar: {
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing.md,
  },
  logo: {
    width: 128,
    height: 128,
  },
  hero: {
    width: width,
    height: 300,
    justifyContent: "flex-end",
  },
  heroContent: {
    padding: spacing.xl,
  },
  heroKicker: {
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: spacing.sm,
    opacity: 0.9,
  },
  heroTitle: {
    fontSize: 48,
    lineHeight: 52,
  },
  heroSub: {
    fontSize: 14,
    marginTop: spacing.sm,
    maxWidth: 280,
    opacity: 0.9,
  },
  chipRow: {
    marginTop: spacing.md,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    height: 48,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  chipRowContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    alignItems: "center",
  },
  chip: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  chipText: {
    fontSize: 13,
    letterSpacing: 0.3,
  },
  columnWrap: {
    paddingHorizontal: spacing.lg,
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
  },
});
