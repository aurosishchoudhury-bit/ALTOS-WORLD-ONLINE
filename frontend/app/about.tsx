import React from "react";
import { StyleSheet } from "react-native";

import InfoPage from "@/src/components/InfoPage";
import AppText from "@/src/components/AppText";
import { colors, spacing } from "@/src/theme/theme";

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
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 22, marginBottom: spacing.md },
  sub: { fontSize: 15, marginTop: spacing.lg, marginBottom: spacing.sm },
  para: { fontSize: 14, lineHeight: 22 },
});
