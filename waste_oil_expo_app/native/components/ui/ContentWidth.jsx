import React from "react";
import { StyleSheet, View } from "react-native";
import { useResponsive } from "../../utils/responsive.js";

/**
 * Centers content and caps width on tablets — use inside screens / list headers.
 */
export function ContentWidth({ children, style, noPad = false }) {
  const { contentMaxWidth, horizontalPad } = useResponsive();
  return (
    <View
      style={[
        styles.base,
        {
          maxWidth: contentMaxWidth,
          paddingHorizontal: noPad ? 0 : horizontalPad,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: "100%",
    alignSelf: "center",
  },
});
