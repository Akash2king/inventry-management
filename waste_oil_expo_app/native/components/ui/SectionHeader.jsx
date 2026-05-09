import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme.js";

export function SectionHeader({ title, right, style }) {
  return (
    <View style={[styles.row, style]}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "900",
    color: theme.colors.textBright,
  },
  right: { flexShrink: 1, alignItems: "flex-end" },
});
