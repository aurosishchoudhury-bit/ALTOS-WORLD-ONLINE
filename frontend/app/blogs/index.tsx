import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import { api, resolveImageUri } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

export default function BlogsList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState<any[]>([]);

  const load = useCallback(() => {
    api.listPosts().then(setPosts).catch(() => {});
  }, []);

  useFocusEffect(load);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="blogs-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Blogs & Vlogs
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        ListEmptyComponent={
          <AppText variant="body" color={colors.muted} style={styles.empty}>
            No posts yet — check back soon!
          </AppText>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`post-${item.id}`}
            onPress={() => router.push(`/blogs/${item.id}`)}
            style={styles.card}
          >
            {!!item.cover_image && (
              <Image source={{ uri: resolveImageUri(item.cover_image) }} style={styles.cover} contentFit="cover" />
            )}
            <View style={styles.cardBody}>
              <View style={styles.typeRow}>
                <Feather
                  name={item.type === "vlog" ? "video" : "file-text"}
                  size={13}
                  color={colors.brand}
                />
                <AppText variant="semibold" color={colors.brand} style={styles.typeText}>
                  {item.type === "vlog" ? "VLOG" : "BLOG"}
                </AppText>
                <AppText variant="body" color={colors.muted} style={styles.date}>
                  {(item.created_at || "").slice(0, 10)}
                </AppText>
              </View>
              <AppText variant="semibold" style={styles.postTitle}>
                {item.title}
              </AppText>
              {item.type === "blog" && !!item.content && (
                <AppText variant="body" color={colors.onSurfaceSecondary} numberOfLines={2} style={styles.snippet}>
                  {item.content}
                </AppText>
              )}
            </View>
          </Pressable>
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
  empty: { fontSize: 13, textAlign: "center", marginTop: spacing.xl },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  cover: { width: "100%", height: 160, backgroundColor: colors.surfaceTertiary },
  cardBody: { padding: spacing.lg },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  typeText: { fontSize: 11, letterSpacing: 1 },
  date: { fontSize: 11, marginLeft: "auto" },
  postTitle: { fontSize: 16, marginTop: spacing.sm },
  snippet: { fontSize: 13, marginTop: spacing.xs, lineHeight: 19 },
});
