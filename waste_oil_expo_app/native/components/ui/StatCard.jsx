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
      hitSlop={8}
    >
      {selected ? <View style={styles.activeRail} /> : null}
      <View style={styles.top}>
        <View style={styles.left}>
          <View style={[styles.iconWrap, selected && styles.iconWrapOn]}>
            <Ionicons name={icon} size={16} color={selected ? "#fff" : theme.colors.textBright} />
          </View>
          <Text
            style={[styles.label, selected && styles.labelOn]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {label}
          </Text>
        </View>
      </View>
      <View style={styles.valueWrap} pointerEvents="none">
        <Text style={[styles.value, selected && styles.valueOn]} numberOfLines={1}>
          {String(value ?? "-")}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 98,
    padding: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceStrong,
    justifyContent: "space-between",
    overflow: "hidden",
    ...theme.shadow.sm,
  },
  cardOn: {
    borderColor: "rgba(15, 118, 110, 0.48)",
    backgroundColor: "#f7fbfa",
  },
  cardPressed: { opacity: 0.94 },
  activeRail: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: theme.colors.accent,
  },
  top: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    minHeight: 30,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconWrapOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  label: {
    fontSize: 12,
    lineHeight: 15,
    color: theme.colors.text,
    fontWeight: "800",
    flexShrink: 1,
    minWidth: 0,
  },
  labelOn: { color: theme.colors.accentHover },
  valueWrap: {
    marginTop: 6,
    minHeight: 28,
    justifyContent: "flex-end",
  },
  // Explicit line metrics to avoid digit-dependent vertical jitter on some Android fonts.
  value: {
    fontSize: 24,
    lineHeight: 28,
    color: theme.colors.textBright,
    fontWeight: "900",
    includeFontPadding: false,
  },
  valueOn: { color: theme.colors.textBright },
});
