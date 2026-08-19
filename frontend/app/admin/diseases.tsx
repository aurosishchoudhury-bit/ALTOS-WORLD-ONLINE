import React, { useCallback, useState } from "react";
import { View, FlatList, Pressable, StyleSheet, Modal, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api, Product } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

export default function ManageDiseases() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [diseases, setDiseases] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [dosages, setDosages] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.listDiseases().then(setDiseases).catch(() => {});
    api.listProducts().then(setProducts).catch(() => {});
  }, []);

  useFocusEffect(load);

  const openForm = (disease?: any) => {
    setEditing(disease || null);
    setName(disease?.name || "");
    setSelected(disease?.product_ids || []);
    setDosages(disease?.dosages || {});
    setModal(true);
  };

  const toggleProduct = (pid: string) =>
    setSelected((prev) => (prev.includes(pid) ? prev.filter((x) => x !== pid) : [...prev, pid]));

  const save = async () => {
    if (!name.trim()) return toast.show("Enter a disease / concern name");
    setSaving(true);
    try {
      const payload = { name: name.trim(), product_ids: selected, dosages };
      if (editing) {
        await api.updateDisease(editing.id, payload);
      } else {
        await api.createDisease(payload);
      }
      toast.show(editing ? "Updated" : "Added");
      setModal(false);
      load();
    } catch {
      toast.show("Could not save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (d: any) => {
    try {
      await api.deleteDisease(d.id);
      setDiseases((prev) => prev.filter((x) => x.id !== d.id));
      toast.show("Deleted");
    } catch {
      toast.show("Could not delete");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="diseases-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          Shop by Disease
        </AppText>
        <Pressable testID="add-disease" onPress={() => openForm()} hitSlop={12} style={styles.backBtn}>
          <Feather name="plus" size={22} color={colors.brand} />
        </Pressable>
      </View>

      <FlatList
        data={diseases}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
        ListEmptyComponent={
          <AppText variant="body" color={colors.muted} style={styles.empty}>
            No health concerns yet. Tap + to add one and map products to it.
          </AppText>
        }
        renderItem={({ item }) => (
          <View style={styles.card} testID={`admin-disease-${item.id}`}>
            <View style={{ flex: 1 }}>
              <AppText variant="semibold" style={styles.name}>
                {item.name}
              </AppText>
              <AppText variant="body" color={colors.muted} style={styles.count}>
                {item.product_count} product{item.product_count === 1 ? "" : "s"} mapped
              </AppText>
            </View>
            <Pressable testID={`edit-disease-${item.id}`} onPress={() => openForm(item)} hitSlop={8} style={styles.iconBtn}>
              <Feather name="edit-2" size={17} color={colors.onSurface} />
            </Pressable>
            <Pressable testID={`delete-disease-${item.id}`} onPress={() => remove(item)} hitSlop={8} style={styles.iconBtn}>
              <Feather name="trash-2" size={17} color={colors.error} />
            </Pressable>
          </View>
        )}
      />

      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <AppText variant="displaySemiBold" style={styles.modalTitle}>
              {editing ? "Edit" : "Add"} Health Concern
            </AppText>
            <FormField
              testID="disease-name"
              label="Disease / concern name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Diabetes, Joint Pain, Immunity"
            />
            <AppText variant="semibold" style={styles.pickLabel}>
              Select products ({selected.length})
            </AppText>
            <ScrollView style={styles.pickList} showsVerticalScrollIndicator={false}>
              {products.map((p) => {
                const on = selected.includes(p.id);
                return (
                  <Pressable
                    key={p.id}
                    testID={`pick-${p.id}`}
                    onPress={() => toggleProduct(p.id)}
                    style={styles.pickRow}
                  >
                    <Feather
                      name={on ? "check-square" : "square"}
                      size={18}
                      color={on ? colors.brand : colors.muted}
                    />
                    <AppText variant="body" style={styles.pickName} numberOfLines={1}>
                      {p.name}
                    </AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
            {selected.length > 0 && (
              <>
                <AppText variant="semibold" style={styles.pickLabel}>
                  Dosage per product
                </AppText>
                <ScrollView style={styles.dosageList} showsVerticalScrollIndicator={false}>
                  {products
                    .filter((p) => selected.includes(p.id))
                    .map((p) => (
                      <View key={`d-${p.id}`} style={styles.dosageRow}>
                        <AppText variant="body" style={styles.dosageName} numberOfLines={1}>
                          {p.name}
                        </AppText>
                        <FormField
                          testID={`dosage-${p.id}`}
                          label=""
                          value={dosages[p.id] || ""}
                          onChangeText={(t) => setDosages((prev) => ({ ...prev, [p.id]: t }))}
                          placeholder="e.g. 2 capsules twice a day"
                        />
                      </View>
                    ))}
                </ScrollView>
              </>
            )}
            <View style={styles.modalActions}>
              <Button label="Cancel" variant="secondary" onPress={() => setModal(false)} style={{ flex: 1 }} />
              <Button testID="save-disease" label="Save" onPress={save} loading={saving} style={{ flex: 1 }} />
            </View>
          </View>
        </View>
      </Modal>
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
  count: { fontSize: 12, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(20,24,20,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    maxHeight: "85%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: { fontSize: 20, marginBottom: spacing.lg },
  pickLabel: { fontSize: 13, marginBottom: spacing.sm },
  pickList: { maxHeight: 160, marginBottom: spacing.md },
  dosageList: { maxHeight: 190, marginBottom: spacing.lg },
  dosageRow: { marginBottom: spacing.xs },
  dosageName: { fontSize: 13, marginBottom: 2 },
  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickName: { fontSize: 14, flex: 1 },
  modalActions: { flexDirection: "row", gap: spacing.md },
});
