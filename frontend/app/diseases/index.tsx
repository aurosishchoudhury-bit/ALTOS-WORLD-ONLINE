import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";

import InfoPage from "@/src/components/InfoPage";
import AppText from "@/src/components/AppText";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

export default function DiseasesScreen() {
  const router = useRouter();
  const [diseases, setDiseases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const visible = diseases.filter((d) =>
    d.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  useFocusEffect(
    useCallback(() => {
      api
        .listDiseases()
        .then(setDiseases)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, []),
  );

  return (
    <InfoPage title="Shop by Concern">
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.intro}>
        Pick a health concern to see the products recommended for it.
      </AppText>
      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={colors.muted} />
        <TextInput
          testID="disease-search"
          value={search}
          onChangeText={setSearch}
          placeholder="Search disease / concern..."
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
      ) : visible.length === 0 ? (
        <AppText variant="body" color={colors.muted} style={styles.empty}>
          {search ? "No matching disease found." : "No health concerns added yet — check back soon."}
        </AppText>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(d) => d.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <Pressable
              testID={`disease-${item.id}`}
              onPress={() => router.push(`/diseases/${item.id}?name=${encodeURIComponent(item.name)}`)}
              style={styles.card}
            >
              <View style={styles.iconWrap}>
                <Feather name="heart" size={18} color={colors.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="semibold" style={styles.name}>
                  {item.name}
                </AppText>
                <AppText variant="body" color={colors.muted} style={styles.count}>
                  {item.product_count} product{item.product_count === 1 ? "" : "s"}
                </AppText>
              </View>
              <Feather name="chevron-right" size={18} color={colors.muted} />
            </Pressable>
          )}
        />
      )}
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 14, lineHeight: 21, marginBottom: spacing.lg },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 46,
    marginBottom: spacing.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.onSurface },
  empty: { fontSize: 13, marginTop: spacing.lg },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 15 },
  count: { fontSize: 12, marginTop: 2 },
});
