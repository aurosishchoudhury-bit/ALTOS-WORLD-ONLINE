import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import { useToast } from "@/src/components/Toast";
import { api, resolveImageUri } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

const GUARDIAN_LABEL: Record<string, string> = { S: "Son of", D: "Daughter of", W: "Wife of" };

export default function ManageRegistrations() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);

  const load = useCallback(() => {
    api.listRegistrations().then(setItems).catch(() => {});
  }, []);

  useFocusEffect(load);

  const openPdf = (r: any) => {
    if (!r.pdf_url) return toast.show("PDF not available for this entry");
    Linking.openURL(resolveImageUri(r.pdf_url)).catch(() => toast.show("Could not open PDF"));
  };

  const remove = async (r: any) => {
    try {
      await api.deleteRegistration(r.id);
      setItems((prev) => prev.filter((x) => x.id !== r.id));
      toast.show("Deleted");
    } catch {
      toast.show("Could not delete");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="reg-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Registrations
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        ListEmptyComponent={
          <AppText variant="body" color={colors.muted} style={styles.empty}>
            No registrations yet. Submissions from the customer Register form will appear here.
          </AppText>
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`registration-${item.id}`}>
            <View style={{ flex: 1 }}>
              <AppText variant="semibold" style={styles.name}>
                {item.title} {item.name}
              </AppText>
              <AppText variant="body" color={colors.muted} style={styles.meta}>
                {item.mobile} · {item.email}
              </AppText>
              <AppText variant="body" color={colors.muted} style={styles.meta}>
                {GUARDIAN_LABEL[item.guardian_type] || "S/D/W of"} {item.guardian_name} · DOB {item.dob}
              </AppText>
              <AppText variant="body" color={colors.muted} style={styles.meta}>
                Nominee: {item.nominee_name} ({item.nominee_relation})
              </AppText>
            </View>
            <Pressable testID={`pdf-${item.id}`} onPress={() => openPdf(item)} hitSlop={8} style={styles.iconBtn}>
              <Feather name="download" size={18} color={colors.brand} />
            </Pressable>
            <Pressable testID={`delete-registration-${item.id}`} onPress={() => remove(item)} hitSlop={8} style={styles.iconBtn}>
              <Feather name="trash-2" size={17} color={colors.error} />
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
  name: { fontSize: 15 },
  meta: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
