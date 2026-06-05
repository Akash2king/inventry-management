import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme.js";

/** Inline spinner — keeps headers/filters visible when loading={false}. */
export function LoadingBlock({ message = "Loading…", fullScreen = false }) {
  return (
    <View style={[styles.wrap, fullScreen && styles.full]}>
      <ActivityIndicator size="large" color={theme.colors.accent} />
      {message ? <Text style={styles.msg}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: theme.space.xxl,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.space.sm,
  },
  full: {
    flex: 1,
  },
  msg: {
    ...theme.type.caption,
    color: theme.colors.text,
  },
});
