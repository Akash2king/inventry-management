import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { theme } from "../../theme.js";
import { useResponsiveType } from "../../utils/typography.js";

const VARIANTS = {
  primary: {
    bg: theme.colors.accent,
    fg: theme.colors.textInverse,
    border: theme.colors.accent,
  },
  secondary: {
    bg: theme.colors.surface,
    fg: theme.colors.accentHover,
    border: theme.colors.border,
  },
  danger: {
    bg: "rgba(239, 68, 68, 0.08)",
    fg: theme.colors.red,
    border: "rgba(239, 68, 68, 0.25)",
  },
  ghost: {
    bg: "transparent",
    fg: theme.colors.accent,
    border: "transparent",
  },
};

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  compact = false,
  style,
  textStyle,
  accessibilityLabel,
}) {
  const type = useResponsiveType();
  const v = VARIANTS[variant] || VARIANTS.primary;
  const off = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: off, busy: loading }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: off ? 0.5 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} size="small" />
      ) : (
        <Text style={[styles.label, type.h3, { color: v.fg }, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  compact: {
    minHeight: 40,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
  },
  label: {
    fontWeight: "600",
  },
});
