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

export default function ManageCertificates() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [certs, setCerts] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      api.listCertificates().then(setCerts).catch(() => {});
    }, []),
  );

  const pickAndUpload = async () => {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      if (perm.canAskAgain || perm.status === "undetermined") {
        const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!req.granted) return toast.show("Gallery access is needed to pick a certificate");
      } else {
        toast.show("Gallery access denied — enable it in Settings");
        Linking.openSettings().catch(() => {});
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const name = asset.fileName || `certificate_${Date.now()}.jpg`;
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
      const cert = await api.addCertificate(data.image_url);
      setCerts((prev) => [...prev, cert]);
      toast.show("Certificate added");
    } catch (e: any) {
      toast.show(e?.message || "Could not upload certificate");
    } finally {
      setUploading(false);
    }
  };

  const remove = async (c: any) => {
    try {
      await api.deleteCertificate(c.id);
      setCerts((prev) => prev.filter((x) => x.id !== c.id));
      toast.show("Certificate deleted");
    } catch {
      toast.show("Could not delete");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="certs-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Certificates ({certs.length})
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={certs}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80 }}
        ListHeaderComponent={
          <Pressable testID="add-certificate" onPress={pickAndUpload} disabled={uploading} style={styles.addBtn}>
            {uploading ? (
              <ActivityIndicator color={colors.brand} size="small" />
            ) : (
              <Feather name="award" size={17} color={colors.brand} />
            )}
            <AppText variant="semibold" color={colors.brand} style={styles.addText}>
              {uploading ? "Uploading…" : "Upload certificate from gallery"}
            </AppText>
          </Pressable>
        }
        ListEmptyComponent={
          <AppText variant="body" color={colors.muted} style={styles.empty}>
            No certificates yet — upload them here and they appear on the About Us page.
          </AppText>
        }
        renderItem={({ item }) => (
          <View style={styles.certCard} testID={`admin-cert-${item.id}`}>
            <Image source={{ uri: resolveImageUri(item.image) }} style={styles.certImg} contentFit="cover" />
            <Pressable testID={`delete-cert-${item.id}`} onPress={() => remove(item)} style={styles.deleteBtn}>
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
  certCard: {
    marginBottom: spacing.lg,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  certImg: {
    width: "100%",
    height: 220,
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
