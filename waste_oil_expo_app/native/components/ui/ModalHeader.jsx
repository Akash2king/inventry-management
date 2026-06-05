import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../theme.js";

export function ModalHeader({ title, onClose, closeLabel = "Close" }) {
  return (
    <View style={styles.head}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={closeLabel}>
        <Text style={styles.close}>{closeLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: theme.space.md,
    paddingVertical: theme.space.sm,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 52,
  },
  title: { flex: 1, ...theme.type.h2, fontSize: 17, marginRight: theme.space.sm },
  close: { color: theme.colors.accent, fontWeight: "600", fontSize: 15 },
});
