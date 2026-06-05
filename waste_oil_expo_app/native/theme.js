/**
 * Chem-Solv mobile design tokens — minimal B2B inventory / workflow.
 * Inspired by modern fulfillment dashboards: neutral canvas, teal accent, status chips.
 */
export const theme = {
  colors: {
    bg: "#F4F6F8",
    bgElevated: "#FFFFFF",
    bgTint: "#E8F4F1",

    surface: "#FFFFFF",
    surfaceMuted: "#F8FAFB",
    surfaceStrong: "#FFFFFF",

    accent: "#0D9488",
    accentHover: "#0F766E",
    accentMuted: "rgba(13, 148, 136, 0.12)",
    accentSoft: "rgba(13, 148, 136, 0.06)",
    tintSoft: "rgba(232, 244, 241, 0.9)",

    border: "rgba(15, 23, 42, 0.08)",
    borderStrong: "rgba(15, 23, 42, 0.14)",
    divider: "rgba(15, 23, 42, 0.06)",

    textBright: "#0F172A",
    text: "#64748B",
    textMuted: "#94A3B8",
    textInverse: "#FFFFFF",

    green: "#0D9488",
    yellow: "#D97706",
    red: "#DC2626",
    success: "#059669",
    warning: "#F59E0B",
    danger: "#EF4444",

    alert: {
      completed: { bg: "#DCFCE7", fg: "#166534", dot: "#22C55E" },
      green: { bg: "#E8F4F1", fg: "#0F766E", dot: "#14B8A6" },
      yellow: { bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B" },
      orange: { bg: "#FFEDD5", fg: "#C2410C", dot: "#F97316" },
      red: { bg: "#FEE2E2", fg: "#B91C1C", dot: "#EF4444" },
    },

    sidebarBg: "rgba(255, 255, 255, 0.72)",
  },

  space: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },

  radius: {
    xs: 6,
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
    pill: 999,
  },

  type: {
    largeTitle: { fontSize: 28, fontWeight: "700", color: "#0F172A", letterSpacing: -0.5 },
    title: { fontSize: 20, fontWeight: "700", color: "#0F172A" },
    h2: { fontSize: 17, fontWeight: "700", color: "#0F172A" },
    h3: { fontSize: 15, fontWeight: "600", color: "#0F172A" },
    body: { fontSize: 14, fontWeight: "500", color: "#64748B", lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: "500", color: "#94A3B8" },
    micro: { fontSize: 11, fontWeight: "600", color: "#94A3B8", letterSpacing: 0.2 },
  },

  motion: {
    fast: 160,
    normal: 240,
    slow: 320,
  },

  shadow: {
    none: {},
    sm: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    md: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  },

  layout: {
    listRowMinHeight: 72,
    tabBarHeight: 56,
    headerActionSize: 40,
    breakpoints: {
      tablet: 600,
      large: 900,
    },
    contentMaxWidth: {
      phone: null,
      tablet: 760,
      large: 980,
    },
  },
};
