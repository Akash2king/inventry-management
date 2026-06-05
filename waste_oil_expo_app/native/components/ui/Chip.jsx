import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme.js";

export function Chip({ label, selected, onPress, badge }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipOn,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
    >
      <Text style={[styles.text, selected && styles.textOn]}>{label}</Text>
      {badge != null && badge > 0 ? (
        <View style={[styles.badge, selected && styles.badgeOn]}>
          <Text style={[styles.badgeText, selected && styles.badgeTextOn]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  chipOn: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pressed: { opacity: 0.88 },
  text: { fontSize: 13, fontWeight: "600", color: theme.colors.textBright },
  textOn: { color: theme.colors.textInverse },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentMuted,
  },
  badgeOn: { backgroundColor: "rgba(255,255,255,0.25)" },
  badgeText: { fontSize: 10, fontWeight: "700", color: theme.colors.accentHover },
  badgeTextOn: { color: theme.colors.textInverse },
});
