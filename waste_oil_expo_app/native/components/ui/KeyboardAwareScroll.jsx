import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";

/**
 * Scroll + keyboard avoidance for forms (phone & tablet).
 * - iOS: padding + automaticallyAdjustKeyboardInsets
 * - Android: works with softwareKeyboardLayoutMode "resize" in app.json
 */
export function KeyboardAwareScroll({
  children,
  contentContainerStyle,
  style,
  keyboardVerticalOffset,
  keyboardAvoiding = true,
  ...scrollProps
}) {
  const headerHeight = useHeaderHeight();
  const offset =
    keyboardVerticalOffset !== undefined ? keyboardVerticalOffset : headerHeight;

  const scroll = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      contentContainerStyle={[styles.content, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  );

  if (!keyboardAvoiding) {
    return scroll;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={offset}
    >
      {scroll}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingBottom: 48,
  },
});
