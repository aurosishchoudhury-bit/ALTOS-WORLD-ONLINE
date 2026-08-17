import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
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
    <InfoPage title="Shop by Disease">
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.intro}>
        Pick a health concern to see the products recommended for it.
      </AppText>
      {loading ? (
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.xl }} />
      ) : diseases.length === 0 ? (
        <AppText variant="body" color={colors.muted} style={styles.empty}>
          No health concerns added yet — check back soon.
        </AppText>
      ) : (
        <FlatList
          data={diseases}
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
