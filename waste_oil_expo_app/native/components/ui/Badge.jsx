import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme.js";

export function Badge({ children, variant = "neutral", style, textStyle, ...rest }) {
  const v = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <View style={[styles.base, v.base, style]} {...rest}>
      <Text style={[styles.text, v.text, textStyle]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

const VARIANTS = {
  neutral: {
    base: { backgroundColor: "rgba(15,23,42,0.04)", borderColor: theme.colors.border },
    text: { color: theme.colors.textBright },
  },
  accent: {
    base: { backgroundColor: theme.colors.accentMuted, borderColor: "rgba(15,118,110,0.22)" },
    text: { color: theme.colors.textBright },
  },
  danger: {
    base: { backgroundColor: "rgba(239,68,68,0.10)", borderColor: "rgba(239,68,68,0.18)" },
    text: { color: "#b91c1c" },
  },
};

const styles = StyleSheet.create({
  base: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  text: { fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
});

