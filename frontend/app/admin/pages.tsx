import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import AppText from "@/src/components/AppText";
import Button from "@/src/components/Button";
import FormField from "@/src/components/FormField";
import { useToast } from "@/src/components/Toast";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

const TABS = [
  { key: "about", label: "About Us" },
  { key: "terms", label: "Terms" },
  { key: "contact", label: "Contact Us" },
];

export default function ManagePages() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [tab, setTab] = useState("about");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");
  const [intro, setIntro] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    setLoading(true);
    api
      .getPage(tab)
      .then((p) => {
        setContent(p.content || "");
        setIntro(p.intro || "");
        setPhone(p.phone || "");
        setEmail(p.email || "");
        setAddress(p.address || "");
      })
      .catch(() => toast.show("Could not load page"))
      .finally(() => setLoading(false));
  }, [tab, toast]);

  const save = async () => {
    setSaving(true);
    try {
      if (tab === "contact") {
        await api.updatePage("contact", { intro, phone, email, address });
      } else {
        await api.updatePage(tab, { content });
      }
      toast.show("Page saved — changes are live");
    } catch {
      toast.show("Could not save page");
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="pages-back" onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color={colors.onSurface} />
        </Pressable>
        <AppText variant="semibold" style={styles.title}>
          App Pages
        </AppText>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Pressable
              key={t.key}
              testID={`page-tab-${t.key}`}
              onPress={() => setTab(t.key)}
              style={[styles.tabChip, on && styles.tabChipOn]}
            >
              <AppText variant={on ? "semibold" : "body"} color={on ? "#fff" : colors.onSurface} style={styles.tabText}>
                {t.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : (
        <KeyboardAwareScrollView
          bottomOffset={90}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {tab === "contact" ? (
            <>
              <FormField
                testID="page-intro"
                label="Intro text"
                value={intro}
                onChangeText={setIntro}
                placeholder="Short welcome message"
                multiline
                numberOfLines={3}
                style={styles.introInput}
              />
              <FormField testID="page-phone" label="Phone / WhatsApp number" value={phone} onChangeText={setPhone} placeholder="+91 ..." keyboardType="phone-pad" />
              <FormField testID="page-email" label="Email" value={email} onChangeText={setEmail} placeholder="store@example.com" keyboardType="email-address" autoCapitalize="none" />
              <FormField
                testID="page-address"
                label="Address"
                value={address}
                onChangeText={setAddress}
                placeholder="Store address"
                multiline
                numberOfLines={3}
                style={styles.introInput}
              />
            </>
          ) : (
            <>
              <AppText variant="semibold" style={styles.fieldLabel}>
                Page content
              </AppText>
              <AppText variant="body" color={colors.muted} style={styles.hint}>
                Separate sections with a blank line. A short first line of a section becomes a bold
                heading. Lines starting with • show as bullet points.
              </AppText>
              <TextInput
                testID="page-content"
                value={content}
                onChangeText={setContent}
                multiline
                style={styles.contentInput}
                placeholder="Write the page content here..."
                placeholderTextColor={colors.muted}
                textAlignVertical="top"
              />
            </>
          )}
        </KeyboardAwareScrollView>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button testID="save-page" label="Save Page" onPress={save} loading={saving} />
      </View>
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
  tabRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  tabChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  tabChipOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: spacing.lg, paddingBottom: 140 },
  fieldLabel: { fontSize: 13, marginBottom: spacing.xs },
  hint: { fontSize: 11, lineHeight: 16, marginBottom: spacing.sm },
  introInput: { minHeight: 80, textAlignVertical: "top" },
  contentInput: {
    minHeight: 380,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    fontSize: 14,
    lineHeight: 21,
    color: colors.onSurface,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
