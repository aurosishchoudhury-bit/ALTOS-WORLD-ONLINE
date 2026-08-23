import React, { useEffect, useState } from "react";
import { StyleSheet } from "react-native";

import InfoPage from "@/src/components/InfoPage";
import PageContent from "@/src/components/PageContent";
import AppText from "@/src/components/AppText";
import { api } from "@/src/api/client";
import { colors, spacing } from "@/src/theme/theme";

export default function Terms() {
  const [content, setContent] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    api
      .getPage("terms")
      .then((p) => {
        setContent(p.content || "");
        setUpdatedAt(p.updated_at || "");
      })
      .catch(() => {});
  }, []);

  const updatedLabel = updatedAt
    ? new Date(updatedAt).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
    : "June 2026";

  return (
    <InfoPage title="Terms & Conditions">
      <AppText variant="body" color={colors.muted} style={styles.updated}>
        Last updated: {updatedLabel}
      </AppText>
      <PageContent content={content} />
    </InfoPage>
  );
}

const styles = StyleSheet.create({
  updated: { fontSize: 12, marginBottom: spacing.sm },
});
