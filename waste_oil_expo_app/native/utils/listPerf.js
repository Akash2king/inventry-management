import { Platform } from "react-native";

/** FlatList tuning for snappy scrolling on mid-range Android devices. */
export const FLATLIST_PERF = {
  initialNumToRender: 14,
  maxToRenderPerBatch: 12,
  windowSize: 9,
  // removeClippedSubviews can blank complex cards on some Android OEM builds.
  removeClippedSubviews: Platform.OS === "ios",
  updateCellsBatchingPeriod: 48,
};
