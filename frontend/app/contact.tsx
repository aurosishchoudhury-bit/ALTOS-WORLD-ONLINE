import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";

import InfoPage from "@/src/components/InfoPage";
import AppText from "@/src/components/AppText";
import { api } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

const WHATSAPP_TEXT = "Hi Altos World! I have a question about my order.";

function Row({
  icon,
  label,
  value,
  onPress,
  testID,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.row}>
      <View style={styles.iconWrap}>
        <Feather name={icon} size={18} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.rowLabel}>
          {label}
        </AppText>
        <AppText variant="semibold" style={styles.rowValue}>
          {value}
        </AppText>
      </View>
      <Feather name="chevron-right" size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function ContactUs() {
  const [page, setPage] = useState<any>({
    intro:
      "Questions about a product, your order or Altos ID pricing? Reach out any day between 9 AM and 8 PM.",
    phone: "+91 77354 54828",
    email: "altosworldonline@gmail.com",
    address: "Altos World — Cuttack Super Zone\nCuttack, Odisha, India",
  });

  useEffect(() => {
    api
      .getPage("contact")
      .then((p) => setPage((prev: any) => ({ ...prev, ...p })))
      .catch(() => {});
  }, []);

  const phoneDigits = (page.phone || "").replace(/\D/g, "");
  return (
    <InfoPage title="Contact Us">
      <AppText variant="displaySemiBold" style={styles.heading}>
        We&rsquo;re here to help
      </AppText>
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.para}>
        {page.intro}
      </AppText>

      <Row
        testID="contact-whatsapp"
        icon="message-circle"
        label="WhatsApp"
        value={page.phone}
        onPress={() =>
          Linking.openURL(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(WHATSAPP_TEXT)}`).catch(() => {})
        }
      />
      <Row
        testID="contact-phone"
        icon="phone"
        label="Call us"
        value={page.phone}
        onPress={() => Linking.openURL(`tel:${phoneDigits}`).catch(() => {})}
      />
      <Row
        testID="contact-email"
        icon="mail"
        label="Email"
        value={page.email}
        onPress={() => Linking.openURL(`mailto:${page.email}`).catch(() => {})}
      />

      <View style={styles.addressCard}>
        <Feather name="map-pin" size={18} color={colors.brand} />
        <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.address}>
          {page.address}
        </AppText>
      </View>
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, marginBottom: spacing.sm },
  para: { fontSize: 14, lineHeight: 22, marginBottom: spacing.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 12 },
  rowValue: { fontSize: 15, marginTop: 2 },
  addressCard: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  address: { flex: 1, fontSize: 14, lineHeight: 21 },
});
