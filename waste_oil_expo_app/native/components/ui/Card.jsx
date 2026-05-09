import React from "react";
import { StyleSheet, View } from "react-native";
import { theme } from "../../theme.js";

export function Card({ children, style, padded = true, variant = "surface", ...rest }) {
  const base =
    variant === "muted"
      ? styles.muted
      : variant === "strong"
        ? styles.strong
        : styles.surface;
  return (
    <View style={[styles.base, base, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadow.sm,
  },
  padded: { padding: theme.space.md },
  surface: { backgroundColor: theme.colors.surfaceStrong },
  strong: { backgroundColor: theme.colors.surfaceStrong },
  muted: { backgroundColor: theme.colors.surfaceMuted },
});

