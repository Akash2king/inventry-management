import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { alertPalette } from "../../utils/alertColors.js";

export function StatusChip({ level, compact }) {
  const pal = alertPalette(level);
  const label = String(level || "green").toUpperCase();
  return (
    <View style={[styles.wrap, { backgroundColor: pal.bg }, compact && styles.compact]}>
      <View style={[styles.dot, { backgroundColor: pal.dot }]} />
      <Text style={[styles.text, { color: pal.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  compact: { paddingVertical: 3, paddingHorizontal: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
});
