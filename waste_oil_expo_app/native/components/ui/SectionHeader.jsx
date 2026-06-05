import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme.js";
import { useResponsive } from "../../utils/responsive.js";
import { useResponsiveType } from "../../utils/typography.js";

export function SectionHeader({ title, subtitle, right, style }) {
  const { horizontalPad } = useResponsive();
  const type = useResponsiveType();
  return (
    <View style={[styles.row, { paddingHorizontal: horizontalPad }, style]}>
      <View style={styles.left}>
        <Text style={[styles.title, type.h2]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, type.caption]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.sm,
    paddingVertical: theme.space.xs,
  },
  left: { flex: 1, minWidth: 0 },
  title: { ...theme.type.h2, fontSize: 16 },
  subtitle: { ...theme.type.caption, marginTop: 2 },
  right: { flexShrink: 1, alignItems: "flex-end" },
});
