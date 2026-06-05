import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme.js";

export function SegmentedControl({ value, options, onChange, style }) {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="tablist">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[styles.btn, selected && styles.btnOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            hitSlop={8}
          >
            <Text style={[styles.text, selected && styles.textOn]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceMuted,
  },
  btn: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  btnOn: { backgroundColor: theme.colors.accent },
  text: { fontSize: 13, fontWeight: "600", color: theme.colors.text },
  textOn: { color: theme.colors.textInverse },
});
