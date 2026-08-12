import React from "react";
import { StyleSheet } from "react-native";

import InfoPage from "@/src/components/InfoPage";
import AppText from "@/src/components/AppText";
import { colors, spacing } from "@/src/theme/theme";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Orders & Acceptance",
    body: "Placing an order on Altos World constitutes an offer to purchase. An order is confirmed only after successful payment. We reserve the right to cancel orders due to stock unavailability, pricing errors or suspected misuse; any amount paid will be refunded in full.",
  },
  {
    title: "2. Pricing",
    body: "All prices are in Indian Rupees (INR) and inclusive of applicable taxes unless stated otherwise. MRP is the maximum retail price. DP (distributor price) is available only to verified Altos ID holders after logging in with their Altos ID. Offer prices, when shown, are limited-time and may change without notice.",
  },
  {
    title: "3. Payments",
    body: "Payments are processed securely through Razorpay. We do not store your card, UPI or banking details. Your order is confirmed only after the payment gateway reports a successful transaction.",
  },
  {
    title: "4. Shipping & Delivery",
    body: "Orders are shipped through our courier partners. Tracking details are shared on WhatsApp once your order is dispatched. Delivery timelines are estimates and may vary due to location, weather or courier delays.",
  },
  {
    title: "5. Returns & Refunds",
    body: "Due to the nature of herbal supplements and skin care products, items can be returned only if received damaged, defective or incorrect. Report such issues within 48 hours of delivery with photos via our Contact Us page. Approved refunds are processed to the original payment method within 7–10 business days.",
  },
  {
    title: "6. Product Information",
    body: "Our products are herbal/ayurvedic in nature and are not intended to diagnose, treat, cure or prevent any disease. Please read labels carefully and consult a healthcare professional before use, especially if pregnant, nursing or on medication.",
  },
  {
    title: "7. Altos ID Verification",
    body: "Altos ID login is used solely to verify membership for DP pricing. We do not store your Altos ID password. Verification lasts for the current app session only.",
  },
  {
    title: "8. Contact",
    body: "For any questions about these terms, reach us through the Contact Us page in the app menu.",
  },
];

export default function Terms() {
  return (
    <InfoPage title="Terms & Conditions">
      <AppText variant="body" color={colors.muted} style={styles.updated}>
        Last updated: June 2026
      </AppText>
      {SECTIONS.map((s) => (
        <React.Fragment key={s.title}>
          <AppText variant="semibold" style={styles.sub}>
            {s.title}
          </AppText>
          <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.para}>
            {s.body}
          </AppText>
        </React.Fragment>
      ))}
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  updated: { fontSize: 12, marginBottom: spacing.sm },
  sub: { fontSize: 15, marginTop: spacing.lg, marginBottom: spacing.xs },
  para: { fontSize: 14, lineHeight: 22 },
});
