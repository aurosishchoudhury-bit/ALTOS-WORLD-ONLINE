import React from "react";
import { View, Pressable, StyleSheet, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";

import InfoPage from "@/src/components/InfoPage";
import AppText from "@/src/components/AppText";
import { colors, spacing, radius } from "@/src/theme/theme";

const ALTOS_ABOUT_URL = "https://www.altosindia.net/about";

export default function AboutUs() {
  return (
    <InfoPage title="About Us">
      <AppText variant="displaySemiBold" style={styles.heading}>
        Altos World — Cuttack Super Zone
      </AppText>
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.para}>
        Altos World is your trusted online store for herbal supplements and natural skin care,
        serving the Cuttack Super Zone and beyond. We believe wellness should be rooted in
        nature — every product we stock is chosen for its purity, quality and plant-powered
        goodness.
      </AppText>
      <AppText variant="semibold" style={styles.sub}>
        What we offer
      </AppText>
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.para}>
        • Herbal supplements to support everyday health and immunity{"\n"}
        • Natural skin care crafted from botanical ingredients{"\n"}
        • Special DP pricing for verified Altos ID holders{"\n"}
        • Fast, tracked delivery to your doorstep
      </AppText>
      <AppText variant="semibold" style={styles.sub}>
        Why shop with us
      </AppText>
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.para}>
        We are an authorised Altos zone, so you always receive genuine products at honest
        prices. Our team personally verifies every order and keeps you updated on WhatsApp —
        from confirmation to delivery.
      </AppText>

      <AppText variant="semibold" style={styles.sub}>
        About Altos Enterprises Limited
      </AppText>
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.para}>
        Altos Enterprises Limited started in the year 2000 with just 7 products and has grown
        into one of India&rsquo;s top direct selling companies dedicated to the betterment of
        people&rsquo;s health. Today Altos offers 250+ products across Health Care, Personal
        Care, Hair Care, FMCG, Agriculture Aid, Home Care, Deos &amp; Perfumes, Aroma Natural
        Beauty and Skin Treatment.
      </AppText>
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.para}>
        • Incorporated under the Companies Act, 1956, Govt. of India{"\n"}
        • Head office in Ludhiana, Punjab, with 5000+ centres across India{"\n"}
        • Most products manufactured in-house at Abhisheik Pharmaceuticals{"\n"}
        • ISO 9001:2008 certified · Proud IDSA member since 2003 · Corporate FICCI member{"\n"}
        • Honoured with the &ldquo;Pride of Country&rdquo; award for best services{"\n"}
        • 100% satisfaction &amp; product return policy, with 99.98% customer retention
      </AppText>
      <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.para}>
        Altos believes: &ldquo;Thinking together is a beginning, staying together is progress
        and working together is success.&rdquo;
      </AppText>

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
  para: { fontSize: 14, lineHeight: 22 },
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
});
