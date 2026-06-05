/** FlatList tuning for snappy scrolling on mid-range Android devices. */
export const FLATLIST_PERF = {
  initialNumToRender: 14,
  maxToRenderPerBatch: 12,
  windowSize: 9,
  removeClippedSubviews: true,
  updateCellsBatchingPeriod: 48,
};
