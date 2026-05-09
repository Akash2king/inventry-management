export const theme = {
  /**
   * Design tokens (mobile).
   * Keep legacy keys (`colors.accent`, `colors.bg`, etc.) for existing screens.
   */
  colors: {
    // Brand palette (mobile): mint base + deep teal accents
    // Base mint requested: #D8EDE8
    // App background is white (requested). Use `bgTint` for mint sections/cards.
    bg: "#ffffff",
    bgTint: "#D8EDE8",
    surface: "#ffffff",
    surfaceMuted: "#ffffff",
    surfaceStrong: "#ffffff",

    accent: "#0f766e",
    accentHover: "#115e59",
    accentMuted: "rgba(15, 118, 110, 0.14)",
    accentSoft: "rgba(15, 118, 110, 0.08)",
    tintSoft: "rgba(216, 237, 232, 0.75)",

    border: "rgba(15, 23, 42, 0.10)",
    shadowSm: "rgba(15, 23, 42, 0.05)",
    shadowMd: "rgba(15, 23, 42, 0.07)",
    shadowLg: "rgba(15, 23, 42, 0.08)",

    textBright: "#0f172a",
    text: "#475569",
    textMuted: "rgba(71, 85, 105, 0.78)",
    textInverse: "#ffffff",

    // Semantic
    green: "#0f766e",
    yellow: "#b45309",
    red: "#b91c1c",
    success: "#16a34a",
    warning: "#f59e0b",
    danger: "#ef4444",

    sidebarBg: "rgba(255, 255, 255, 0.55)",
  },

  space: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 14,
    lg: 16,
    xl: 20,
    xxl: 24,
  },

  radius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 18,
    pill: 999,
  },

  type: {
    title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
    h2: { fontSize: 16, fontWeight: "800", color: "#0f172a" },
    body: { fontSize: 14, fontWeight: "600", color: "#475569" },
    caption: { fontSize: 12, fontWeight: "600", color: "rgba(71, 85, 105, 0.78)" },
  },

  /**
   * Shadow presets. Use `elevation` on Android; iOS uses shadow*.
   * These are intentionally subtle to keep cards clean on mint background.
   */
  shadow: {
    sm: {
      shadowColor: "#0f172a",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    md: {
      shadowColor: "#0f172a",
      shadowOpacity: 0.10,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
  },
};

