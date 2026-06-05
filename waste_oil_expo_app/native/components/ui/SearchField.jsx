import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../theme.js";
import { useResponsiveType } from "../../utils/typography.js";

export function SearchField({
  value,
  onChangeText,
  placeholder = "Search…",
  onSubmit,
  submitLabel = "Search",
  style,
}) {
  const type = useResponsiveType();
  return (
    <View style={[styles.wrap, style]}>
      <Ionicons name="search" size={18} color={theme.colors.textMuted} style={styles.icon} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, type.input]}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {onSubmit ? (
        <Pressable onPress={onSubmit} style={styles.submit} hitSlop={8}>
          <Text style={styles.submitText}>{submitLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: theme.space.sm,
    width: "100%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingLeft: theme.space.sm,
    minHeight: 46,
  },
  icon: { marginRight: 4 },
  input: {
    flex: 1,
    fontSize: 15,
    color: theme.colors.textBright,
    paddingVertical: 10,
    paddingRight: theme.space.xs,
  },
  submit: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: 8,
    marginRight: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.accent,
  },
  submitText: {
    color: theme.colors.textInverse,
    fontSize: 12,
    fontWeight: "700",
  },
});
