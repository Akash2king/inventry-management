import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme.js";
import { useResponsive } from "../../utils/responsive.js";
import { useResponsiveType } from "../../utils/typography.js";

export function PageHeader({ title, subtitle, right, style }) {
  const { horizontalPad } = useResponsive();
  const type = useResponsiveType();
  return (
    <View style={[styles.wrap, { paddingHorizontal: horizontalPad }, style]}>
      <View style={styles.textCol}>
        <Text style={[styles.title, type.largeTitle, { fontSize: type.largeTitle.fontSize - 2 }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, type.body]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: theme.space.sm,
    paddingTop: theme.space.sm,
    paddingBottom: theme.space.sm,
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { ...theme.type.largeTitle },
  subtitle: { ...theme.type.caption, marginTop: 2 },
  right: { flexShrink: 0, flexDirection: "row", alignItems: "center", gap: theme.space.xs },
});
