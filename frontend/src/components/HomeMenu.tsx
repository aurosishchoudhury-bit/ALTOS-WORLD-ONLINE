import React, { useState } from "react";
import { View, Modal, Pressable, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "./AppText";
import { colors, spacing, radius } from "@/src/theme/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  categories: string[];
  onSelectCategory: (category: string) => void;
};

export default function HomeMenu({ visible, onClose, categories, onSelectCategory }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [catsOpen, setCatsOpen] = useState(false);

  const go = (path: string) => {
    onClose();
    router.push(path as any);
  };

  const Item = ({
    icon,
    label,
    onPress,
    testID,
    trailing,
  }: {
    icon: keyof typeof Feather.glyphMap;
    label: string;
    onPress: () => void;
    testID: string;
    trailing?: React.ReactNode;
  }) => (
    <Pressable testID={testID} onPress={onPress} style={styles.item}>
      <Feather name={icon} size={19} color={colors.brand} />
      <AppText variant="semibold" style={styles.itemLabel}>
        {label}
      </AppText>
      {trailing}
    </Pressable>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.drawer, { paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.drawerHeader}>
            <AppText variant="displaySemiBold" style={styles.drawerTitle}>
              Menu
            </AppText>
            <Pressable testID="menu-close" onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Feather name="x" size={22} color={colors.onSurface} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Item
              testID="menu-home"
              icon="home"
              label="Home"
              onPress={() => {
                onSelectCategory("All");
                onClose();
              }}
            />
            <Item testID="menu-about" icon="info" label="About Us" onPress={() => go("/about")} />
            <Item
              testID="menu-diseases"
              icon="heart"
              label="Shop by Disease"
              onPress={() => go("/diseases")}
            />
            <Item
              testID="menu-categories"
              icon="grid"
              label="Categories"
              onPress={() => setCatsOpen((v) => !v)}
              trailing={
                <Feather
                  name={catsOpen ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.muted}
                />
              }
            />
            {catsOpen &&
              ["All", ...categories].map((cat) => (
                <Pressable
                  key={cat}
                  testID={`menu-category-${cat}`}
                  onPress={() => {
                    onSelectCategory(cat);
                    onClose();
                  }}
                  style={styles.subItem}
                >
                  <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.subLabel}>
                    {cat}
                  </AppText>
                </Pressable>
              ))}
            <Item
              testID="menu-terms"
              icon="file-text"
              label="Terms and Conditions"
              onPress={() => go("/terms")}
            />
            <Item testID="menu-contact" icon="phone" label="Contact Us" onPress={() => go("/contact")} />
          </ScrollView>

          <AppText variant="body" color={colors.muted} style={styles.footerText}>
            Altos World · Cuttack Super Zone
          </AppText>
        </View>
        <Pressable testID="menu-backdrop" style={styles.backdrop} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(20,24,20,0.45)",
  },
  drawer: {
    width: "78%",
    maxWidth: 340,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  backdrop: { flex: 1 },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
  },
  drawerTitle: { fontSize: 24 },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "flex-end",
    flexDirection: "row",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLabel: { fontSize: 15, flex: 1 },
  subItem: {
    paddingVertical: spacing.md,
    paddingLeft: spacing.xl + spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subLabel: { fontSize: 14 },
  footerText: { fontSize: 11, marginTop: spacing.lg },
});
