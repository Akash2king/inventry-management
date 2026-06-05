import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme.js";

export function IconButton({
  icon,
  label,
  onPress,
  disabled,
  style,
  iconColor,
  accessibilityLabel,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      hitSlop={10}
    >
      <View style={styles.row}>
        <Ionicons name={icon} size={18} color={iconColor || theme.colors.textBright} />
        <Text style={styles.text}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 40,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    justifyContent: "center",
  },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { fontSize: 12, fontWeight: "600", color: theme.colors.textBright },
});

