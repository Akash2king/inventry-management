import React from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "../../theme.js";

export function Card({ children, style, padded = true, variant = "surface", elevated = false, ...rest }) {
  const base =
    variant === "muted"
      ? styles.muted
      : variant === "strong"
        ? styles.strong
        : styles.surface;
  return (
    <View
      style={[styles.base, base, elevated && theme.shadow.sm, padded && styles.padded, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  padded: { padding: theme.space.md },
  surface: { backgroundColor: theme.colors.surface },
  strong: { backgroundColor: theme.colors.surface },
  muted: { backgroundColor: theme.colors.surfaceMuted },
});
