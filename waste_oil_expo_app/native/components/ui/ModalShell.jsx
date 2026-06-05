import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme.js";

/** Full-screen modal root — always clears status bar / notch (top + bottom). */
export function ModalShell({ children, style, backgroundColor }) {
  return (
    <SafeAreaView
      style={[styles.safe, backgroundColor ? { backgroundColor } : null, style]}
      edges={["top", "bottom"]}
    >
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
});
