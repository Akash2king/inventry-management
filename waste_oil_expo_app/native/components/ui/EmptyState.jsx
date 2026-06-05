import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme.js";
import { Button } from "./Button.jsx";
export function EmptyState({
  icon = "file-tray-outline",
  title = "Nothing here yet",
  message,
  actionLabel,
  onAction,
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={28} color={theme.colors.accent} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {actionLabel && onAction ? (
        <Button title={actionLabel} onPress={onAction} variant="secondary" style={styles.btn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: theme.space.xxl,
    paddingHorizontal: theme.space.xl,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.space.md,
  },
  title: {
    ...theme.type.h2,
    textAlign: "center",
  },
  message: {
    ...theme.type.body,
    textAlign: "center",
    marginTop: theme.space.xs,
    lineHeight: 20,
  },
  btn: {
    marginTop: theme.space.lg,
    alignSelf: "stretch",
    maxWidth: 280,
  },
});
