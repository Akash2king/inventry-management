import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme.js";

export function IconAction({ icon, label, onPress, variant = "default" }) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        isPrimary && styles.primary,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={16}
          color={isPrimary ? theme.colors.textInverse : theme.colors.accent}
        />
      ) : null}
      {label ? (
        <Text style={[styles.label, isPrimary && styles.labelOn]} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  primary: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  pressed: { opacity: 0.88 },
  label: { fontSize: 13, fontWeight: "600", color: theme.colors.accentHover },
  labelOn: { color: theme.colors.textInverse },
});
