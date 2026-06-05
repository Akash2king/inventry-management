import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme.js";
import { FadeIn } from "./FadeIn.jsx";

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <FadeIn style={styles.wrap}>
      <View style={styles.banner}>
        <Ionicons name="alert-circle-outline" size={20} color={theme.colors.red} />
        <Text style={styles.text}>{message}</Text>
        {onRetry ? (
          <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
            <Text style={styles.retry}>Retry</Text>
          </Pressable>
        ) : null}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: theme.space.lg,
    paddingBottom: theme.space.sm,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
    borderRadius: theme.radius.md,
    padding: theme.space.md,
  },
  text: {
    flex: 1,
    color: theme.colors.red,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  retry: {
    color: theme.colors.accent,
    fontWeight: "800",
    fontSize: 13,
  },
});
