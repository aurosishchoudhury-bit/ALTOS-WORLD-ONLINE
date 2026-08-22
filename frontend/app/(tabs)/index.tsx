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
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import AppText from "@/src/components/AppText";
import ProductCard from "@/src/components/ProductCard";
import HomeMenu from "@/src/components/HomeMenu";
import WhatsAppFab from "@/src/components/WhatsAppFab";
import BannerCarousel from "@/src/components/BannerCarousel";
import { useToast } from "@/src/components/Toast";
import { useCart } from "@/src/context/CartContext";
import { useAltosAuth } from "@/src/context/AltosAuthContext";
import { api, Product, resolveImageUri } from "@/src/api/client";
import { getPriceInfo } from "@/src/utils/pricing";
import { openBulkOrderChat } from "@/src/utils/whatsapp";
import { colors, spacing, radius, fonts, formatINR } from "@/src/theme/theme";

const { width } = Dimensions.get("window");
const LOGO = require("../../assets/images/altos-logo.jpg");

export default function Storefront() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addItem } = useCart();
  const { verified } = useAltosAuth();
  const toast = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [active, setActive] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [banners, setBanners] = useState<any[]>([]);

  useEffect(() => {
    api.listBanners().then(setBanners).catch(() => {});
  }, []);

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

  const query = search.trim().toLowerCase();
  const searchResults = query
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query),
      )
    : [];
  // Grid shows: search results, or the selected category. On "All" (no search) we show category rows instead.
  const visible = query ? searchResults : active === "All" ? [] : products;

  const bestsellers = !query && active === "All" ? products.filter((p) => p.bestseller) : [];

  const MiniCard = ({ p, prefix }: { p: Product; prefix: string }) => {
    const info = getPriceInfo(p, verified);
    return (
      <Pressable
        testID={`${prefix}-${p.id}`}
        onPress={() => router.push(`/product/${p.id}`)}
        style={styles.bsCard}
      >
        <Image source={{ uri: resolveImageUri(p.image) }} style={styles.bsImage} contentFit="cover" />
        <AppText variant="medium" numberOfLines={2} style={styles.bsName}>
          {p.name}
        </AppText>
        <View style={styles.bsPriceRow}>
          <AppText variant="semibold" style={styles.bsPrice}>
            {formatINR(info.unit)}
          </AppText>
          {info.compareAt !== null && (
            <AppText variant="body" color={colors.muted} style={styles.bsMrp}>
              {formatINR(info.compareAt)}
            </AppText>
          )}
        </View>
      </Pressable>
    );
  };

  const Header = (
    <View>
      <View style={[styles.logoBar, { paddingTop: insets.top + spacing.md }]}>
        <Pressable
          testID="menu-button"
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setMenuOpen(true);
          }}
          hitSlop={8}
          style={styles.menuBtn}
        >
          <Feather name="menu" size={24} color={colors.onSurface} />
        </Pressable>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <View style={styles.menuBtn} />
      </View>

      <BannerCarousel banners={banners} />

      <Pressable
        testID="home-shop-by-disease"
        onPress={() => router.push("/diseases")}
        style={styles.diseaseBtn}
      >
        <Feather name="heart" size={17} color={colors.brand} />
        <AppText variant="semibold" style={styles.diseaseBtnText}>
          Shop by Disease
        </AppText>
        <Feather name="chevron-right" size={17} color={colors.muted} />
      </Pressable>

      <Pressable
        testID="home-blogs"
        onPress={() => router.push("/blogs")}
        style={styles.diseaseBtn}
      >
        <Feather name="film" size={17} color={colors.brand} />
        <AppText variant="semibold" style={styles.diseaseBtnText}>
          Blogs & Vlogs
        </AppText>
        <Feather name="chevron-right" size={17} color={colors.muted} />
      </Pressable>

      <View style={styles.loginWrap}>
        {verified ? (
          <View style={[styles.loginBox, styles.loginBoxVerified]} testID="altos-verified-box">
            <View style={styles.loginIconWrap}>
              <Feather name="check-circle" size={20} color={colors.success} />
            </View>
            <View style={styles.loginTextWrap}>
              <AppText variant="semibold" style={styles.loginTitle} color={colors.success}>
                Logged in as Altos ID holder
              </AppText>
              <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.loginSub}>
                DP prices unlocked for you
              </AppText>
            </View>
          </View>
        ) : (
          <View style={styles.loginBox} testID="altos-login-box">
            <View style={styles.loginIconWrap}>
              <Feather name="user" size={20} color={colors.brand} />
            </View>
            <View style={styles.loginTextWrap}>
              <AppText variant="semibold" style={styles.loginTitle}>
                Altos ID Holder?
              </AppText>
              <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.loginSub}>
                Log in to unlock DP prices
              </AppText>
            </View>
            <Pressable
              testID="altos-login-button"
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                router.push("/altos-login");
              }}
              style={styles.loginBtn}
            >
              <AppText variant="semibold" color={colors.onBrand} style={styles.loginBtnText}>
                Log in
              </AppText>
            </Pressable>
          </View>
        )}
        {!verified && (
          <Pressable
            testID="register-link"
            onPress={() => router.push("/register")}
            style={styles.registerLink}
          >
            <Feather name="user-plus" size={15} color={colors.brand} />
            <AppText variant="semibold" color={colors.brand} style={styles.registerLinkText}>
              New here? Register as a Direct Seller
            </AppText>
          </Pressable>
        )}
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

      {active !== "All" && !query && (
        <View style={styles.catHeaderBar} testID="active-category-bar">
          <AppText variant="displaySemiBold" style={styles.catTitle}>
            {active}
          </AppText>
          <Pressable testID="back-to-all" onPress={() => onSelectCategory("All")} style={styles.viewAll}>
            <Feather name="grid" size={14} color={colors.brand} />
            <AppText variant="semibold" color={colors.brand} style={styles.viewAllText}>
              All categories
            </AppText>
          </Pressable>
        </View>
      )}

      {bestsellers.length > 0 && (
        <View style={styles.bsSection} testID="bestsellers-row">
          <View style={styles.bsHeader}>
            <Feather name="star" size={16} color={colors.brand} />
            <AppText variant="displaySemiBold" style={styles.bsTitle}>
              Bestsellers
            </AppText>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.bsRowContent}
          >
            {bestsellers.map((p) => {
              const info = getPriceInfo(p, verified);
              return (
                <Pressable
                  key={p.id}
                  testID={`bestseller-${p.id}`}
                  onPress={() => router.push(`/product/${p.id}`)}
                  style={styles.bsCard}
                >
                  <Image source={{ uri: resolveImageUri(p.image) }} style={styles.bsImage} contentFit="cover" />
                  <AppText variant="medium" numberOfLines={2} style={styles.bsName}>
                    {p.name}
                  </AppText>
                  <View style={styles.bsPriceRow}>
                    <AppText variant="semibold" style={styles.bsPrice}>
                      {formatINR(info.unit)}
                    </AppText>
                    {info.compareAt !== null && (
                      <AppText variant="body" color={colors.muted} style={styles.bsMrp}>
                        {formatINR(info.compareAt)}
                      </AppText>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {!query && active === "All" &&
        categories.map((cat) => {
          const items = products.filter((p) => p.category === cat);
          if (items.length === 0) return null;
          return (
            <View key={cat} style={styles.bsSection} testID={`cat-row-${cat}`}>
              <View style={styles.bsHeader}>
                <AppText variant="displaySemiBold" style={styles.catTitle}>
                  {cat}
                </AppText>
                <Pressable
                  testID={`view-all-${cat}`}
                  onPress={() => onSelectCategory(cat)}
                  style={styles.viewAll}
                  hitSlop={8}
                >
                  <AppText variant="semibold" color={colors.brand} style={styles.viewAllText}>
                    View all
                  </AppText>
                  <Feather name="chevron-right" size={14} color={colors.brand} />
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.bsRowContent}
              >
                {items.slice(0, 10).map((p) => (
                  <MiniCard key={p.id} p={p} prefix={`cat-${cat}`} />
                ))}
              </ScrollView>
            </View>
          );
        })}
    </View>
  );

  if (loading && products.length === 0) {
    return (
      <View style={styles.container}>
        {Header}
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
        <HomeMenu
          visible={menuOpen}
          onClose={() => setMenuOpen(false)}
          categories={categories}
          onSelectCategory={onSelectCategory}
        />
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
        ListFooterComponent={
          <Pressable testID="bulk-order-button" onPress={openBulkOrderChat} style={styles.bulkBtn}>
            <FontAwesome name="whatsapp" size={20} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
              <AppText variant="semibold" style={styles.bulkBtnTitle}>
                For Bulk Orders — Click Here
              </AppText>
              <AppText variant="body" style={styles.bulkBtnSub}>
                Chat directly with us on WhatsApp
              </AppText>
            </View>
            <Feather name="chevron-right" size={18} color="#FFFFFF" />
          </Pressable>
        }
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
            ) : active === "All" ? null : (
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
      <HomeMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={categories}
        onSelectCategory={onSelectCategory}
      />
      <WhatsAppFab />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#25D366",
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  bulkBtnTitle: { fontSize: 15, color: "#FFFFFF" },
  bulkBtnSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginTop: 1 },
  registerLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  registerLinkText: { fontSize: 13 },
  center: {
    paddingVertical: spacing["3xl"],
    alignItems: "center",
    gap: spacing.md,
  },
  logoBar: {
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
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
  bsSection: {
    marginTop: spacing.lg,
  },
  bsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  bsTitle: {
    fontSize: 18,
  },
  catTitle: { fontSize: 18, fontWeight: "700" },
  catHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  viewAll: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: "auto" },
  viewAllText: { fontSize: 13 },
  bsRowContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  bsCard: {
    width: 150,
  },
  bsImage: {
    width: 150,
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  bsName: {
    fontSize: 13,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  bsPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: 2,
  },
  bsPrice: {
    fontSize: 14,
  },
  bsMrp: {
    fontSize: 11,
    textDecorationLine: "line-through",
  },
  loginWrap: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  diseaseBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    height: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  diseaseBtnText: { fontSize: 14, flex: 1 },
  loginBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.lg,
  },
  loginBoxVerified: {
    borderColor: colors.success,
    backgroundColor: colors.brandTertiary,
  },
  loginIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  loginTextWrap: {
    flex: 1,
  },
  loginTitle: {
    fontSize: 15,
  },
  loginSub: {
    fontSize: 12,
    marginTop: 2,
  },
  loginBtn: {
    height: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnText: {
    fontSize: 14,
    letterSpacing: 0.3,
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
