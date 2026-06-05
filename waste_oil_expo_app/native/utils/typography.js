import { useMemo } from "react";
import { Platform } from "react-native";
import { theme } from "../theme.js";
import { useResponsive } from "./responsive.js";

function scale(size, factor) {
  return Math.round(size * factor);
}

/** Scaled theme.type tokens for tablet / large tablet readability. */
export function useResponsiveType() {
  const { fontScale } = useResponsive();
  return useMemo(
    () => ({
      largeTitle: {
        ...theme.type.largeTitle,
        fontSize: scale(28, fontScale),
        lineHeight: scale(34, fontScale),
      },
      title: {
        ...theme.type.title,
        fontSize: scale(20, fontScale),
        lineHeight: scale(26, fontScale),
      },
      h2: {
        ...theme.type.h2,
        fontSize: scale(17, fontScale),
        lineHeight: scale(22, fontScale),
      },
      h3: {
        ...theme.type.h3,
        fontSize: scale(15, fontScale),
        lineHeight: scale(20, fontScale),
      },
      body: {
        ...theme.type.body,
        fontSize: scale(14, fontScale),
        lineHeight: scale(20, fontScale),
      },
      caption: {
        ...theme.type.caption,
        fontSize: scale(12, fontScale),
        lineHeight: scale(16, fontScale),
      },
      micro: {
        ...theme.type.micro,
        fontSize: scale(11, fontScale),
        lineHeight: scale(14, fontScale),
      },
      label: {
        fontSize: scale(13, fontScale),
        fontWeight: "600",
        color: theme.colors.textBright,
        lineHeight: scale(18, fontScale),
      },
      input: {
        fontSize: scale(16, fontScale),
        lineHeight: scale(22, fontScale),
        color: theme.colors.textBright,
      },
      inputPad: {
        paddingHorizontal: scale(12, fontScale),
        paddingVertical: Platform.OS === "ios" ? scale(14, fontScale) : scale(10, fontScale),
      },
    }),
    [fontScale],
  );
}
