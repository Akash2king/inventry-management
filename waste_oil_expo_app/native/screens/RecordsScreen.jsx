import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAuth } from "../AuthContext.jsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { theme } from "../theme.js";
import {
  Chip,
  EmptyState,
  ErrorBanner,
  IconAction,
  LoadingBlock,
  PageHeader,
  RecordListCard,
  SearchField,
} from "../components/ui/index.js";
import { FLATLIST_PERF } from "../utils/listPerf.js";
import { showSuccess, showError } from "../utils/feedback.js";
import { formatDate, formatQty, slaTotalDays } from "../utils/formatters.js";
import { formatHolderLine } from "../utils/holderDisplay.js";
import { useResponsive } from "../utils/responsive.js";
import { ContentWidth } from "../components/ui/ContentWidth.jsx";

const STAGES = ["", "1", "2", "3", "4", "5"];
const ALERTS = ["", "green", "yellow", "orange", "red", "completed"];

async function ensureDocsDir() {
  const dir = `${FileSystem.documentDirectory}downloads/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

function daysBetween(a, b) {
  const da = a ? new Date(a) : null;
  const db = b ? new Date(b) : null;
  if (!da || !db || Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  const ms = db.getTime() - da.getTime();
  return Math.max(0, Math.round(ms / 86400000));
}

function formatDateValue(date) {
  const d = date instanceof Date ? date : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateValue(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return new Date();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function RecordsScreen({ navigation }) {
  const { api, refreshUser, user } = useAuth();
  const { listColumns, horizontalPad, contentMaxWidth, gridGap } = useResponsive();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState("open"); // open | all
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [stage, setStage] = useState("");
  const [alert, setAlert] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [exportBusy, setExportBusy] = useState(false);
  const [datePicker, setDatePicker] = useState(null);

  const excludeCompleted = mode !== "all";
  const canSeeAll = user?.role === "gm" || user?.role === "superadmin" || user?.role === "manager";
  const effectiveMode = useMemo(() => (canSeeAll ? mode : "open"), [canSeeAll, mode]);
  const isBelowManager = user?.role === "storeman" || user?.role === "treatment" || user?.role === "admin";
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (stage) n += 1;
    if (alert) n += 1;
    if (search.trim()) n += 1;
    if (dateFrom.trim()) n += 1;
    if (dateTo.trim()) n += 1;
    if (overdueOnly) n += 1;
    if (departmentId.trim()) n += 1;
    return n;
  }, [stage, alert, search, dateFrom, dateTo, overdueOnly, departmentId]);

  function applyPickedDate(event, selectedDate) {
    const field = datePicker;
    if (Platform.OS === "android") setDatePicker(null);
    if (event?.type === "dismissed" || !selectedDate || !field) return;
    const next = formatDateValue(selectedDate);
    if (field === "from") setDateFrom(next);
    if (field === "to") setDateTo(next);
  }

  // Default GM/Superadmin/Manager to "all" once user is known.
  useEffect(() => {
    if (!canSeeAll) return;
    // Force initial load to true "all" mode to avoid showing an "open" slice.
    if (mode !== "all") {
      setMode("all");
      setLoading(true);
      setPage(1);
      setTotal(0);
      void load(1, { append: false, forceMode: "all" });
    }
  }, [canSeeAll]);

  // Peer roles should not use completed-only filters.
  useEffect(() => {
    if (isBelowManager && alert === "completed") setAlert("");
  }, [isBelowManager, alert]);

  const load = useCallback(async (nextPage = 1, opts = {}) => {
    if (!api) return;
    const append = Boolean(opts.append);
    const forceMode = opts.forceMode;
    const effective = forceMode || effectiveMode;
    const res = await api.records.getAll({
      page: nextPage,
      page_size: 100,
      exclude_completed: effective !== "all",
      stage: stage || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      search: search.trim() || undefined,
      alert_level: alert || undefined,
      overdue: overdueOnly ? true : undefined,
      department_id: departmentId || undefined,
    });
    if (res.ok) {
      const list = Array.isArray(res.data?.results) ? res.data.results : [];
      setRecords((prev) => (nextPage === 1 || !append ? list : [...prev, ...list]));
      setTotal(Number(res.data?.count || 0));
      setPage(nextPage);
      setLoadError("");
    } else {
      if (nextPage === 1) setRecords([]);
      setLoadError(res.error || "Could not load records");
    }
    setLoading(false);
    setRefreshing(false);
  }, [api, effectiveMode, search, stage, dateFrom, dateTo, alert, overdueOnly, departmentId]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    setTotal(0);
    load(1, { append: false });
  }, [load, effectiveMode]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    await load(1, { append: false });
  };

  const canLoadMore = records.length > 0 && total > records.length;
  const loadNext = useCallback(async () => {
    if (!canLoadMore || loadingMore || loading || refreshing) return;
    setLoadingMore(true);
    try {
      await load(page + 1, { append: true });
    } finally {
      setLoadingMore(false);
    }
  }, [canLoadMore, loadingMore, loading, refreshing, load, page]);

  const exportExcel = useCallback(async () => {
    if (!api) return;
    setExportBusy(true);
    try {
      const PAGE_SIZE = 200;
      const all = [];
      let pageNum = 1;
      for (;;) {
        const res = await api.records.getAll({
          page: pageNum,
          page_size: PAGE_SIZE,
          exclude_completed: effectiveMode !== "all",
          stage: stage || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          search: search.trim() || undefined,
          alert_level: alert || undefined,
          overdue: overdueOnly ? true : undefined,
          department_id: departmentId || undefined,
        });
        if (!res.ok) throw new Error(res.error || "Export failed");
        const rows = Array.isArray(res.data?.results) ? res.data.results : [];
        all.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        pageNum += 1;
        if (pageNum > 200) break;
      }

      const headers = [
        "record_number",
        "vendor",
        "product_type",
        "packaging",
        "quantity",
        "unit",
        "entry_date",
        "due_date",
        "sla_total_days",
        "stage",
        "alert",
        "department",
        "current_holder",
      ];

      const data = [
        headers,
        ...all.map((r) => [
          r.record_number || "",
          r.vendor_name || "",
          r.product_type || "",
          r.packaging || "",
          r.quantity ?? "",
          r.unit || "",
          r.entry_date || "",
          r.due_date || "",
          typeof r.sla_total_days === "number" ? r.sla_total_days : daysBetween(r.entry_date, r.due_date) ?? "",
          r.current_stage ?? "",
          (r.computed_alert_level || r.alert_level || "").toString(),
          r.current_department_name || "",
          r.current_holder_name || r.current_holder_username || r.current_holder || "",
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Records");
      const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

      const stamp = new Date().toISOString().slice(0, 10);
      const dir = await ensureDocsDir();
      const uri = `${dir}records_export_${stamp}.xlsx`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: "base64" });
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error("File write failed");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Share records export",
        });
      }
      // Always show where file was saved
      showSuccess("Export saved to Documents");
    } catch (e) {
      showError(e?.message || "Export failed");
    } finally {
      setExportBusy(false);
    }
  }, [api, effectiveMode, stage, dateFrom, dateTo, search, alert, overdueOnly, departmentId]);

  const openRecord = useCallback(
    (item) => {
      navigation.getParent()?.navigate("RecordDetail", {
        recordId: String(item.id),
        title: item.record_number,
      });
    },
    [navigation],
  );

  const renderRecord = useCallback(
    ({ item }) => (
      <RecordListCard
        item={item}
        gridMode={listColumns > 1}
        onPress={() => openRecord(item)}
        formatDate={formatDate}
        formatQty={formatQty}
        slaTotalDays={slaTotalDays}
        formatHolderLine={formatHolderLine}
      />
    ),
    [openRecord, listColumns],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <PageHeader
        title="Records"
        subtitle={user?.full_name || user?.username || "—"}
        right={
          <>
            {user?.role === "storeman" && !user?.must_change_password ? (
              <IconAction
                icon="add"
                label="New"
                variant="primary"
                onPress={() => navigation.getParent()?.navigate("RecordForm", { mode: "create" })}
              />
            ) : null}
          </>
        }
      />

      <ContentWidth>
      <View style={styles.chipRow}>
        {canSeeAll ? (
          <>
            <Chip label="Open" selected={effectiveMode === "open"} onPress={() => setMode("open")} />
            <Chip label="All" selected={effectiveMode === "all"} onPress={() => setMode("all")} />
          </>
        ) : null}
        <Chip
          label={showFilters ? "Hide filters" : "Filters"}
          selected={showFilters}
          onPress={() => setShowFilters((s) => !s)}
          badge={activeFilterCount}
        />
        <Chip
          label={exportBusy ? "Exporting…" : "Export"}
          selected={false}
          onPress={() => !exportBusy && void exportExcel()}
        />
      </View>

      {activeFilterCount > 0 ? (
        <View style={styles.filterBanner}>
          <Text style={styles.filterBannerText}>
            {activeFilterCount} active filter{activeFilterCount === 1 ? "" : "s"}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setStage("");
              setAlert("");
              setSearchInput("");
              setSearch("");
              setDateFrom("");
              setDateTo("");
              setOverdueOnly(false);
              setDepartmentId("");
              setLoading(true);
              void load(1, { append: false });
            }}
          >
            <Text style={styles.filterBannerAction}>Clear all</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showFilters ? (
        <View style={styles.filters}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Stage</Text>
            <View style={styles.chips}>
              {STAGES.map((s) => {
                const on = stage === s;
                return (
                  <TouchableOpacity
                    key={`st-${s || "all"}`}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setStage(s)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>{s ? `S${s}` : "All"}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Alert</Text>
            <View style={styles.chips}>
              {ALERTS.filter((a) => (isBelowManager ? a !== "completed" : true)).map((a) => {
                const on = alert === a;
                return (
                  <TouchableOpacity
                    key={`al-${a || "all"}`}
                    style={[styles.chip, on && styles.chipOn]}
                    onPress={() => setAlert(a)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {a ? a.toUpperCase() : "All"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.filterGrid}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={styles.filterLabel}>Date from</Text>
              <TouchableOpacity style={styles.dateFilter} onPress={() => setDatePicker("from")}>
                <Text style={styles.dateFilterText}>{dateFrom || "Start date"}</Text>
                <Text style={styles.dateFilterAction}>Pick</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={styles.filterLabel}>Date to</Text>
              <TouchableOpacity style={styles.dateFilter} onPress={() => setDatePicker("to")}>
                <Text style={styles.dateFilterText}>{dateTo || "End date"}</Text>
                <Text style={styles.dateFilterAction}>Pick</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.filterGrid}>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={styles.filterLabel}>Department id</Text>
              <TextInput
                value={departmentId}
                onChangeText={setDepartmentId}
                placeholder="e.g. 1"
                placeholderTextColor="#94a3b8"
                style={styles.filterInput}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={styles.filterLabel}>Overdue only</Text>
              <View style={styles.switchRow}>
                <Switch value={overdueOnly} onValueChange={setOverdueOnly} />
                <Text style={styles.switchText}>{overdueOnly ? "Yes" : "No"}</Text>
              </View>
            </View>
          </View>

          <View style={styles.filterActions}>
            <TouchableOpacity
              style={styles.filterBtnGhost}
              onPress={() => {
                setStage("");
                setAlert("");
                setDateFrom("");
                setDateTo("");
                setOverdueOnly(false);
                setDepartmentId("");
                setSearchInput("");
                setSearch("");
                setLoading(true);
                void load(1, { append: false });
              }}
            >
              <Text style={styles.filterBtnGhostText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterBtnPrimary}
              onPress={() => {
                setSearch(searchInput.trim());
                setLoading(true);
                void load(1, { append: false });
              }}
            >
              <Text style={styles.filterBtnPrimaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <SearchField
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Record number, vendor…"
        onSubmit={() => {
          setSearch(searchInput.trim());
          setLoading(true);
        }}
      />
      </ContentWidth>
      <ErrorBanner
        message={loadError}
        onRetry={() => {
          setLoading(true);
          void load(1, { append: false });
        }}
      />
      {loading && !records.length ? (
        <LoadingBlock message="Loading records…" />
      ) : (
        <FlatList
          data={records}
          key={`records-${listColumns}`}
          numColumns={listColumns}
          columnWrapperStyle={listColumns > 1 ? { gap: gridGap, paddingHorizontal: horizontalPad } : undefined}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.accent}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadNext()}
          renderItem={renderRecord}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          {...FLATLIST_PERF}
          ListEmptyComponent={
            <EmptyState
              icon="folder-open-outline"
              title="No records found"
              message="Try adjusting filters or pull to refresh."
            />
          }
          ListFooterComponent={
            canLoadMore ? (
              <TouchableOpacity
                style={styles.loadMore}
                onPress={() => {
                  void loadNext();
                }}
              >
                <Text style={styles.loadMoreText}>{loadingMore ? "Loading…" : "Load more"}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.footerHint}>
                {records.length ? `${records.length} / ${total || records.length}` : ""}
              </Text>
            )
          }
          contentContainerStyle={[
            records.length === 0 ? styles.emptyWrap : styles.listPad,
            { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" },
          ]}
        />
      )}
      {datePicker ? (
        <View style={Platform.OS === "ios" ? styles.iosPickerWrap : null}>
          {Platform.OS === "ios" ? (
            <View style={styles.iosPickerHead}>
              <TouchableOpacity onPress={() => setDatePicker(null)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <DateTimePicker
            value={parseDateValue(datePicker === "from" ? dateFrom : dateTo)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={applyPickedDate}
          />
        </View>
      ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  flex: { flex: 1 },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.space.xs,
    paddingBottom: theme.space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    gap: 6,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: theme.colors.textBright,
  },
  meta: {
    fontSize: 12,
    color: theme.colors.text,
  },
  headerBtn: {
    backgroundColor: theme.colors.accentMuted,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.20)",
  },
  headerNewBtn: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: theme.colors.accent,
  },
  headerNewBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
  },
  headerBtnInner: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerBtnText: {
    color: theme.colors.accentHover,
    fontWeight: "900",
    fontSize: 12,
  },
  filterCountBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 6,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.accentHover,
  },
  filterCountBadgeText: { color: "#fff", fontWeight: "900", fontSize: 11 },
  headerBtnGhost: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerBtnGhostText: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: 12,
  },
  headerChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  headerChipOn: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  headerChipText: { fontSize: 12, fontWeight: "900", color: theme.colors.textBright },
  headerChipTextOn: { color: "#fff" },
  filterBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.tintSoft,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  filterBannerText: { color: theme.colors.textBright, fontSize: 12, fontWeight: "900" },
  filterBannerAction: { color: theme.colors.accentHover, fontSize: 12, fontWeight: "900" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: theme.colors.textBright,
    backgroundColor: theme.colors.surface,
  },
  searchBtn: {
    backgroundColor: theme.colors.accentHover,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    justifyContent: "center",
  },
  searchBtnText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  filters: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  filterRow: { gap: 8 },
  filterLabel: { fontSize: 12, fontWeight: "900", color: "#334155" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  chipOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { fontSize: 11, fontWeight: "900", color: "#0f172a" },
  chipTextOn: { color: "#fff" },
  filterGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  filterInput: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  dateFilter: {
    marginTop: 6,
    minHeight: 42,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  dateFilterText: { color: "#0f172a", fontSize: 13, fontWeight: "800" },
  dateFilterAction: { color: theme.colors.accentHover, fontSize: 12, fontWeight: "900" },
  iosPickerWrap: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingBottom: 10,
  },
  iosPickerHead: {
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalClose: { color: theme.colors.accentHover, fontWeight: "900" },
  switchRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  switchText: { fontSize: 12, color: "#475569", fontWeight: "800" },
  filterActions: { flexDirection: "row", gap: 10, marginTop: 2 },
  filterBtnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  filterBtnGhostText: { color: "#334155", fontWeight: "900" },
  filterBtnPrimary: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: "center",
  },
  filterBtnPrimaryText: { color: "#fff", fontWeight: "900" },
  listPad: {
    paddingVertical: 8,
  },
  cardWrap: {},
  row: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 5,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  rowSub: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
  },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  cardSub: { marginTop: 2, fontSize: 13, color: "#64748b", fontWeight: "700" },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(226,232,240,0.9)",
  },
  badgeText: { fontSize: 11, fontWeight: "900" },
  kvRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  kvKey: { fontSize: 11, fontWeight: "900", color: "#64748b", width: 48 },
  kvVal: { fontSize: 12, fontWeight: "800", color: "#0f172a", flexShrink: 1, minWidth: 70 },
  notice: {
    borderWidth: 1,
    borderColor: "rgba(201, 162, 39, 0.45)",
    backgroundColor: "rgba(255, 232, 160, 0.35)",
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  noticeTitle: { fontSize: 12, fontWeight: "900", color: "#92400e" },
  noticeText: { fontSize: 12, color: "#92400e", fontWeight: "700", lineHeight: 16 },
  remarks: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  remarksTitle: { fontSize: 12, fontWeight: "900", color: "#0f172a" },
  remarksText: { fontSize: 12, color: "#334155", fontWeight: "700", lineHeight: 16 },
  emptyWrap: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  empty: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 14,
  },
  loadMore: {
    marginTop: 10,
    marginHorizontal: 12,
    marginBottom: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  loadMoreText: { color: "#15803d", fontWeight: "900" },
  footerHint: { textAlign: "center", color: "#94a3b8", fontSize: 12, paddingVertical: 14 },
});
