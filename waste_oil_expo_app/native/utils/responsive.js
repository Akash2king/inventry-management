import { useMemo } from "react";
import { useWindowDimensions } from "react-native";

/** Width breakpoints (dp) — aligned with Material / iOS tablet guidance. */
export const BREAKPOINTS = {
  tablet: 600,
  large: 900,
};

export function getResponsiveMetrics(width) {
  const isTablet = width >= BREAKPOINTS.tablet;
  const isLarge = width >= BREAKPOINTS.large;

  return {
    width,
    isPhone: !isTablet,
    isTablet,
    isLarge,
    /** Max readable content width (centered on tablets). */
    contentMaxWidth: isLarge ? 980 : isTablet ? 760 : width,
    /** Horizontal page padding. */
    horizontalPad: isLarge ? 32 : isTablet ? 24 : 16,
    /** List / card grid columns. */
    listColumns: isLarge ? 3 : isTablet ? 2 : 1,
    kpiColumns: isLarge ? 4 : isTablet ? 3 : 2,
    dialogMaxWidth: isLarge ? 480 : isTablet ? 420 : 340,
    formMaxWidth: isLarge ? 640 : isTablet ? 520 : width - 32,
    gridGap: isTablet ? 14 : 10,
    titleScale: isLarge ? 1.12 : isTablet ? 1.06 : 1,
    /** Typography scale — tablet text slightly larger for arm's-length reading. */
    fontScale: isLarge ? 1.18 : isTablet ? 1.1 : 1,
  };
}

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return useMemo(() => ({ ...getResponsiveMetrics(width), height }), [width, height]);
}

/** ScrollView contentContainerStyle for centered tablet layouts. */
export function useScrollContentStyle(extra = {}) {
  const r = useResponsive();
  return useMemo(
    () => ({
      width: "100%",
      maxWidth: r.contentMaxWidth,
      alignSelf: "center",
      paddingHorizontal: r.horizontalPad,
      paddingBottom: 32,
      ...extra,
    }),
    [r.contentMaxWidth, r.horizontalPad, extra],
  );
}

/** Wrapper style for a single item inside numColumns FlatList. */
export function gridItemStyle(columns, gap) {
  if (columns <= 1) return { width: "100%" };
  return {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: gap / 2,
    marginBottom: gap,
  };
}
