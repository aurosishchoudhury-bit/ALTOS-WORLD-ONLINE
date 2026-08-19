import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, Linking, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

type Month = { month: string; label: string; orders: number };

export default function SalesReports() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [months, setMonths] = useState<Month[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api
      .reportMonths()
      .then(setMonths)
      .catch(() => setMonths([]))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(load);

  const download = (month: string, format: "pdf" | "csv") => {
    Linking.openURL(api.salesReportUrl(month, format)).catch(() =>
      toast.show("Could not open the report"),
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="reports-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Sales Reports
        </AppText>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <FlatList
          data={months}
          keyExtractor={(m) => m.month}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
          ListHeaderComponent={
            <AppText variant="body" color={colors.muted} style={styles.intro}>
              Monthly reports of paid orders. Download as PDF or Excel (CSV).
            </AppText>
          }
          ListEmptyComponent={
            <AppText variant="body" color={colors.muted} style={styles.empty}>
              No paid orders yet. Reports will appear here once you have sales.
            </AppText>
          }
          renderItem={({ item }) => (
            <View style={styles.card} testID={`report-${item.month}`}>
              <View style={{ flex: 1 }}>
                <AppText variant="semibold" style={styles.month}>
                  {item.label}
                </AppText>
                <AppText variant="body" color={colors.muted} style={styles.count}>
                  {item.orders} paid order{item.orders === 1 ? "" : "s"}
                </AppText>
              </View>
              <Pressable
                testID={`pdf-${item.month}`}
                onPress={() => download(item.month, "pdf")}
                style={[styles.dlBtn, styles.pdfBtn]}
              >
                <Feather name="file-text" size={15} color="#fff" />
                <AppText variant="semibold" style={styles.dlText}>
                  PDF
                </AppText>
              </Pressable>
              <Pressable
                testID={`csv-${item.month}`}
                onPress={() => download(item.month, "csv")}
                style={[styles.dlBtn, styles.csvBtn]}
              >
                <Feather name="grid" size={15} color="#fff" />
                <AppText variant="semibold" style={styles.dlText}>
                  Excel
                </AppText>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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
  intro: { fontSize: 13, marginBottom: spacing.lg },
  empty: { fontSize: 13, textAlign: "center", marginTop: spacing.xl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: spacing.md,
  },
  month: { fontSize: 15 },
  count: { fontSize: 12, marginTop: 2 },
  dlBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  pdfBtn: { backgroundColor: colors.brand },
  csvBtn: { backgroundColor: "#1D6F42" },
  dlText: { fontSize: 12, color: "#fff" },
});
