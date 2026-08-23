import React, { useEffect, useState } from "react";
import { View, Pressable, StyleSheet, Linking, ScrollView } from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";

import InfoPage from "@/src/components/InfoPage";
import PageContent from "@/src/components/PageContent";
import AppText from "@/src/components/AppText";
import { api, resolveImageUri } from "@/src/api/client";
import { colors, spacing, radius } from "@/src/theme/theme";

const ALTOS_ABOUT_URL = "https://www.altosindia.net/about";

export default function AboutUs() {
  const [certs, setCerts] = useState<any[]>([]);
  const [content, setContent] = useState("");

  useEffect(() => {
    api.listCertificates().then(setCerts).catch(() => {});
    api
      .getPage("about")
      .then((p) => setContent(p.content || ""))
      .catch(() => {});
  }, []);

  return (
    <InfoPage title="About Us">
      <AppText variant="displaySemiBold" style={styles.heading}>
        Altos World — Cuttack Super Zone
      </AppText>

      <PageContent content={content} />

      {certs.length > 0 && (
        <>
          <AppText variant="semibold" style={styles.sub}>
            Our Certificates
          </AppText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.certRow}
            testID="certificates-row"
          >
            {certs.map((c) => (
              <Image
                key={c.id}
                source={{ uri: resolveImageUri(c.image) }}
                style={styles.certImg}
                contentFit="cover"
              />
            ))}
          </ScrollView>
        </>
      )}

      <Pressable
        testID="altos-about-link"
        onPress={() => Linking.openURL(ALTOS_ABOUT_URL).catch(() => {})}
        style={styles.linkCard}
      >
        <Feather name="external-link" size={18} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <AppText variant="semibold" style={styles.linkTitle}>
            Learn more about Altos Enterprises
          </AppText>
          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.linkSub}>
            www.altosindia.net/about
          </AppText>
        </View>
        <Feather name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, marginBottom: spacing.md },
  sub: { fontSize: 15, marginTop: spacing.lg, marginBottom: spacing.sm },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
  },
  linkTitle: { fontSize: 14 },
  linkSub: { fontSize: 12, marginTop: 2 },
  certRow: {
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  certImg: {
    width: 220,
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
});
