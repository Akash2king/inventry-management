import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { theme } from "../theme.js";

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

function badgeColor(level) {
  const k = String(level || "").toLowerCase();
  if (k === "completed") return { bg: "#dcfce7", fg: "#166534" };
  if (k === "red") return { bg: "rgba(239,68,68,0.12)", fg: "#b91c1c" };
  if (k === "orange") return { bg: "rgba(249,115,22,0.12)", fg: "#c2410c" };
  if (k === "yellow") return { bg: "rgba(234,179,8,0.16)", fg: "#92400e" };
  return { bg: "rgba(34,197,94,0.12)", fg: "#166534" };
}

function fmt(v) {
  const s = v == null ? "" : String(v).trim();
  return s ? s : "—";
}

export function RecordsScreen({ navigation }) {
  const { api, logout, refreshUser, user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [mode, setMode] = useState("open"); // open | all
  const [search, setSearch] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [stage, setStage] = useState("");
  const [alert, setAlert] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [departmentId, setDepartmentId] = useState("");
  const [exportBusy, setExportBusy] = useState(false);

  const excludeCompleted = mode !== "all";
  const canSeeAll = user?.role === "gm" || user?.role === "superadmin" || user?.role === "manager";
  const effectiveMode = useMemo(() => (canSeeAll ? mode : "open"), [canSeeAll, mode]);
  const isBelowManager = user?.role === "storeman" || user?.role === "treatment" || user?.role === "admin";
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (stage) n += 1;
    if (alert) n += 1;
    if (dateFrom.trim()) n += 1;
    if (dateTo.trim()) n += 1;
    if (overdueOnly) n += 1;
    if (departmentId.trim()) n += 1;
    return n;
  }, [stage, alert, dateFrom, dateTo, overdueOnly, departmentId]);

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
    } else {
      if (nextPage === 1) setRecords([]);
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
      Alert.alert("Saved", `Saved to Documents:\n${uri}`);
    } finally {
      setExportBusy(false);
    }
  }, [api, effectiveMode, stage, dateFrom, dateTo, search, alert, overdueOnly, departmentId]);

  return (
    <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Records</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {user?.full_name || user?.username || "—"}
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        {canSeeAll ? (
          <TouchableOpacity
            style={[styles.headerChip, effectiveMode === "open" && styles.headerChipOn]}
            onPress={() => setMode("open")}
          >
            <Text style={[styles.headerChipText, effectiveMode === "open" && styles.headerChipTextOn]}>Open</Text>
          </TouchableOpacity>
        ) : null}
        {canSeeAll ? (
          <TouchableOpacity
            style={[styles.headerChip, effectiveMode === "all" && styles.headerChipOn]}
            onPress={() => setMode("all")}
          >
            <Text style={[styles.headerChipText, effectiveMode === "all" && styles.headerChipTextOn]}>All</Text>
          </TouchableOpacity>
        ) : null}

        {user?.role === "storeman" && !user?.must_change_password ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.getParent()?.navigate("RecordForm", { mode: "create" })}
          >
            <Text style={styles.headerBtnText}>New</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={styles.headerBtn} onPress={() => setShowFilters((s) => !s)}>
          <View style={styles.headerBtnInner}>
            <Text style={styles.headerBtnText}>{showFilters ? "Hide filters" : "Filters"}</Text>
            {activeFilterCount > 0 ? (
              <View style={styles.filterCountBadge}>
                <Text style={styles.filterCountBadgeText}>{activeFilterCount}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.headerBtn, exportBusy && { opacity: 0.6 }]}
          disabled={exportBusy}
          onPress={() => void exportExcel()}
        >
          <Text style={styles.headerBtnText}>{exportBusy ? "Exporting…" : "Export"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate("QueueTab")}>
          <Text style={styles.headerBtnText}>Queue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate("SettingsTab")}>
          <Text style={styles.headerBtnText}>Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerBtnGhost}
          onPress={() =>
            void logout().then(() =>
              navigation.getParent()?.reset({ index: 0, routes: [{ name: "Login" }] }),
            )
          }
        >
          <Text style={styles.headerBtnGhostText}>Sign out</Text>
        </TouchableOpacity>
      </View>

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
              <Text style={styles.filterLabel}>Date from (YYYY-MM-DD)</Text>
              <TextInput
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="2026-01-01"
                placeholderTextColor="#94a3b8"
                style={styles.filterInput}
              />
            </View>
            <View style={{ flex: 1, minWidth: 140 }}>
              <Text style={styles.filterLabel}>Date to (YYYY-MM-DD)</Text>
              <TextInput
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="2026-01-31"
                placeholderTextColor="#94a3b8"
                style={styles.filterInput}
              />
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
                setLoading(true);
                void load(1, { append: false });
              }}
            >
              <Text style={styles.filterBtnGhostText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.filterBtnPrimary}
              onPress={() => {
                setLoading(true);
                void load(1, { append: false });
              }}
            >
              <Text style={styles.filterBtnPrimaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      <View style={styles.searchBar}>
        <TextInput
          value={search}
          onChangeText={(t) => setSearch(t)}
          placeholder="Search record number, vendor…"
          placeholderTextColor="#94a3b8"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => {
            setLoading(true);
            void load(1);
          }}
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => {
            setLoading(true);
            void load(1);
          }}
        >
          <Text style={styles.searchBtnText}>Go</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => void loadNext()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.getParent()?.navigate("RecordDetail", {
                  recordId: String(item.id),
                  title: item.record_number,
                })
              }
            >
              <View style={styles.cardHead}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.record_number}
                    {item.needs_workflow_correction ? "  • NEEDS FIX" : ""}
                  </Text>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {fmt(item.vendor_name)}
                  </Text>
                </View>
                {(() => {
                  const lvl = item.computed_alert_level || item.alert_level || "green";
                  const c = badgeColor(lvl);
                  return (
                    <View style={[styles.badge, { backgroundColor: c.bg }]}>
                      <Text style={[styles.badgeText, { color: c.fg }]}>{String(lvl).toUpperCase()}</Text>
                    </View>
                  );
                })()}
              </View>

              {item.pending_return_feedback ? (
                <View style={styles.notice}>
                  <Text style={styles.noticeTitle}>Fix requested</Text>
                  <Text style={styles.noticeText} numberOfLines={3}>
                    {String(item.pending_return_feedback)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Product</Text>
                <Text style={styles.kvVal} numberOfLines={1}>
                  {fmt(item.product_type)}
                </Text>
                <Text style={styles.kvKey}>Pack</Text>
                <Text style={styles.kvVal} numberOfLines={1}>
                  {fmt(item.packaging)}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Stage</Text>
                <Text style={styles.kvVal}>{fmt(item.current_stage)}</Text>
                <Text style={styles.kvKey}>Qty</Text>
                <Text style={styles.kvVal}>
                  {fmt(item.quantity)} {item.unit || ""}
                </Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Entry</Text>
                <Text style={styles.kvVal}>{fmt(item.entry_date)}</Text>
                <Text style={styles.kvKey}>Due</Text>
                <Text style={styles.kvVal}>{fmt(item.due_date)}</Text>
              </View>
              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>SLA</Text>
                <Text style={styles.kvVal}>
                  {typeof item.sla_total_days === "number"
                    ? `${item.sla_total_days}d`
                    : daysBetween(item.entry_date, item.due_date) != null
                      ? `${daysBetween(item.entry_date, item.due_date)}d`
                      : "—"}
                </Text>
                <Text style={styles.kvKey}>Dept</Text>
                <Text style={styles.kvVal} numberOfLines={1}>
                  {fmt(item.current_department_name)}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Driver</Text>
                <Text style={styles.kvVal} numberOfLines={1}>
                  {fmt(item.driver_name)}
                </Text>
                <Text style={styles.kvKey}>Vehicle</Text>
                <Text style={styles.kvVal} numberOfLines={1}>
                  {fmt(item.vehicle_details)}
                </Text>
              </View>

              <View style={styles.kvRow}>
                <Text style={styles.kvKey}>Holder</Text>
                <Text style={styles.kvVal} numberOfLines={1}>
                  {item.current_holder_name || item.current_holder_username
                    ? `${item.current_holder_name || ""}${item.current_holder_username ? ` (@${item.current_holder_username})` : ""}`
                    : item.current_holder
                      ? String(item.current_holder)
                      : "—"}
                </Text>
                <Text style={styles.kvKey}>Photo</Text>
                <Text style={styles.kvVal}>{item.photo_path ? "Yes" : "—"}</Text>
              </View>

              {item.remarks ? (
                <View style={styles.remarks}>
                  <Text style={styles.remarksTitle}>Remarks</Text>
                  <Text style={styles.remarksText} numberOfLines={4}>
                    {String(item.remarks)}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No open records in this slice. Pull to refresh.</Text>
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
          contentContainerStyle={records.length === 0 ? styles.emptyWrap : styles.listPad}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
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
  chipOn: { backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" },
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
    backgroundColor: "#15803d",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  filterBtnPrimaryText: { color: "#fff", fontWeight: "900" },
  listPad: {
    paddingVertical: 8,
  },
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
