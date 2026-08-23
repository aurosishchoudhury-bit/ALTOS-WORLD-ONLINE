import React from "react";
import { StyleSheet } from "react-native";

import AppText from "./AppText";
import { colors, spacing } from "@/src/theme/theme";

/**
 * Renders admin-editable page text. Blocks are separated by blank lines;
 * when a block has multiple lines and a short first line, that line is
 * treated as a bold section heading.
 */
export default function PageContent({ content }: { content: string }) {
  const blocks = (content || "").split(/\n\s*\n/).filter((b) => b.trim());
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const hasHeading = lines.length > 1 && lines[0].trim().length <= 60;
        const heading = hasHeading ? lines[0].trim() : null;
        const body = (hasHeading ? lines.slice(1) : lines).join("\n").trim();
        return (
          <React.Fragment key={i}>
            {heading && (
              <AppText variant="semibold" style={styles.sub}>
                {heading}
              </AppText>
            )}
            {!!body && (
              <AppText variant="body" color={colors.onSurfaceSecondary} style={styles.para}>
                {body}
              </AppText>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 15, marginTop: spacing.lg, marginBottom: spacing.xs },
  para: { fontSize: 14, lineHeight: 22 },
});
