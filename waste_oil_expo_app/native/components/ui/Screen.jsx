import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../../theme.js";

export function Screen({ children, edges = ["top", "bottom"], style }) {
  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
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
