import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme.js";

export function StatCard({ icon, label, value, selected, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardOn,
        pressed && styles.cardPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      hitSlop={6}
    >
      <View style={styles.top}>
        <View style={[styles.iconWrap, selected && styles.iconWrapOn]}>
          <Ionicons name={icon} size={15} color={selected ? theme.colors.textInverse : theme.colors.text} />
        </View>
        <Text style={[styles.label, selected && styles.labelOn]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.value, selected && styles.valueOn]} numberOfLines={1}>
        {String(value ?? "—")}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 88,
    padding: theme.space.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "space-between",
  },
  cardOn: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  cardPressed: { opacity: 0.92 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.bg,
  },
  iconWrapOn: { backgroundColor: theme.colors.accent },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: theme.colors.text,
  },
  labelOn: { color: theme.colors.accentHover },
  value: {
    marginTop: 8,
    fontSize: 26,
    fontWeight: "700",
    color: theme.colors.textBright,
    includeFontPadding: false,
  },
  valueOn: { color: theme.colors.textBright },
});
