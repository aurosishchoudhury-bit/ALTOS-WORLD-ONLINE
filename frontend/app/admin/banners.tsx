import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator, Platform, Linking } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import { useToast } from "@/src/components/Toast";
import { api, API, resolveImageUri } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

const MAX_BANNERS = 8;

export default function ManageBanners() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [banners, setBanners] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.listBanners().then(setBanners).catch(() => {});
    }, []),
  );

  const pickAndUpload = async () => {
    if (banners.length >= MAX_BANNERS) return toast.show(`Maximum ${MAX_BANNERS} banners — delete one first`);
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain || perm.status === "undetermined") {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!req.granted) return toast.show("Gallery access is needed to pick a banner image");
      } else {
        toast.show("Gallery access denied — enable it in Settings");
        Linking.openSettings().catch(() => {});
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.75 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const name = asset.fileName || `banner_${Date.now()}.jpg`;
      const type = asset.mimeType || "image/jpeg";
      const form = new FormData();
      if (Platform.OS === "web") {
        const blob = await (await fetch(asset.uri)).blob();
        form.append("file", blob, name);
      } else {
        form.append("file", { uri: asset.uri, name, type } as any);
      }
      const res = await fetch(`${API}/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || "Upload failed");
      const data = await res.json();
      const banner = await api.addBanner(data.image_url);
      setBanners((prev) => [...prev, banner]);
      toast.show("Banner added");
    } catch (e: any) {
      toast.show(e?.message || "Could not upload banner");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (b: any) => {
    try {
      await api.deleteBanner(b.id);
      setBanners((prev) => prev.filter((x) => x.id !== b.id));
      toast.show("Banner deleted");
    } catch {
      toast.show("Could not delete");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="banners-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Home Banners ({banners.length}/{MAX_BANNERS})
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={banners}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        ListHeaderComponent={
          <Pressable
            testID="add-banner"
            onPress={pickAndUpload}
            disabled={uploading}
            style={styles.addBtn}
          >
            {uploading ? (
              <ActivityIndicator color={colors.brand} size="small" />
            ) : (
              <Feather name="image" size={17} color={colors.brand} />
            )}
            <AppText variant="semibold" color={colors.brand} style={styles.addText}>
              {uploading ? "Uploading…" : "Add banner from gallery"}
            </AppText>
          </Pressable>
        }
        ListEmptyComponent={
          <AppText variant="body" color={colors.muted} style={styles.empty}>
            No banners yet — add up to 4. They auto-scroll on the home screen.
          </AppText>
        }
        renderItem={({ item }) => (
          <View style={styles.bannerCard} testID={`admin-banner-${item.id}`}>
            <Image source={{ uri: resolveImageUri(item.image) }} style={styles.bannerImg} contentFit="cover" />
            <Pressable testID={`delete-banner-${item.id}`} onPress={() => remove(item)} style={styles.deleteBtn}>
              <Feather name="trash-2" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
      />
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  addText: { fontSize: 14 },
  empty: { fontSize: 13, textAlign: "center", marginTop: spacing.lg },
  bannerCard: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  bannerImg: {
    width: "100%",
    height: 140,
    backgroundColor: colors.surfaceSecondary,
  },
  deleteBtn: {
    position: "absolute",
    top: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(20,24,20,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
});
