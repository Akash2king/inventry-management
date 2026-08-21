import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";
import { STAGE_LABELS } from "../utils/stageLabels.js";
import { stageForRole } from "../utils/permissions.js";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme.js";
import { Badge, Card, ErrorBanner, LoadingBlock, SegmentedControl, SectionHeader, StatCard } from "../components/ui/index.js";
import { FLATLIST_PERF } from "../utils/listPerf.js";
import { showSuccess, showError } from "../utils/feedback.js";
import { useResponsive } from "../utils/responsive.js";
import { ContentWidth } from "../components/ui/ContentWidth.jsx";
import appLogo from "../assets/app-logo.png";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";

function isPeerRole(role) {
  return role === "storeman" || role === "treatment" || role === "admin";
}

function alertLevelOf(r) {
  return String(r?.computed_alert_level || r?.alert_level || "green").toLowerCase();
}

function badgeColor(level) {
  const k = String(level || "").toLowerCase();
  if (k === "completed") return { bg: "#dcfce7", fg: "#166534", border: "rgba(22,101,52,0.20)" };
  if (k === "red") return { bg: "rgba(239,68,68,0.12)", fg: "#b91c1c", border: "rgba(185,28,28,0.25)" };
  if (k === "orange") return { bg: "rgba(249,115,22,0.12)", fg: "#c2410c", border: "rgba(194,65,12,0.25)" };
  if (k === "yellow") return { bg: "rgba(234,179,8,0.16)", fg: "#92400e", border: "rgba(146,64,14,0.22)" };
  return { bg: "rgba(34,197,94,0.12)", fg: "#166534", border: "rgba(22,101,52,0.18)" };
}

function asDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(d) {
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

async function ensureDocsDir() {
  const dir = `${FileSystem.documentDirectory}downloads/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export function DashboardScreen({ navigation }) {
  const { api, user, refreshUser } = useAuth();
  const { horizontalPad, contentMaxWidth, kpiColumns, listColumns, gridGap } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState("overview"); // overview | analytics
  const [slice, setSlice] = useState("default"); // default | dueSoon | overdue | queue | completed | loaded
  const [queue, setQueue] = useState([]);
  const [records, setRecords] = useState([]);
  const [exportBusy, setExportBusy] = useState(false);

  const role = user?.role || "";
  const peer = isPeerRole(role);
  const myStage = stageForRole(role);

  const load = useCallback(async () => {
    if (!api) return;
    const recordFilters = {
      page_size: 120,
      ...(peer ? { exclude_completed: true } : {}),
      ...(peer && myStage != null ? { stage: myStage } : {}),
    };
    try {
      const [q, r] = await Promise.all([
        api.workflow.getQueue(),
        api.records.getAll(recordFilters),
      ]);
      const errors = [];
      if (q.ok && Array.isArray(q.data)) setQueue(q.data);
      else {
        setQueue([]);
        if (!q.ok) errors.push(q.error || "Could not load queue");
      }
      if (r.ok) {
        const list = Array.isArray(r.data?.results) ? r.data.results : [];
        setRecords(list);
      } else {
        setRecords([]);
        errors.push(r.error || "Could not load records");
      }
      setLoadError(errors.join(" · "));
    } catch (e) {
      setQueue([]);
      setRecords([]);
      setLoadError(e?.message || "Could not load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, peer, myStage]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    await load();
  };

  const active = useMemo(
    () => records.filter((r) => alertLevelOf(r) !== "completed"),
    [records],
  );
  const overdue = useMemo(
    () => records.filter((r) => alertLevelOf(r) === "red"),
    [records],
  );
  const completed = useMemo(
    () => records.filter((r) => alertLevelOf(r) === "completed"),
    [records],
  );

  const atMyStageOpen = useMemo(() => {
    if (!peer || myStage == null) return [];
    return active.filter((r) => Number(r.current_stage) === Number(myStage));
  }, [peer, myStage, active]);

  const dueSoon = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    return active
      .map((r) => {
        const dd = r.due_date ? new Date(r.due_date) : null;
        const ok = dd && !Number.isNaN(dd.getTime());
        return { ...r, _due: ok ? dd : null };
      })
      .filter((r) => r._due && r._due >= today && r._due <= in7)
      .sort((a, b) => a._due - b._due);
  }, [active]);

  const alertCounts = useMemo(() => {
    const counts = { green: 0, yellow: 0, orange: 0, red: 0 };
    active.forEach((r) => {
      const k = alertLevelOf(r);
      if (Object.prototype.hasOwnProperty.call(counts, k)) counts[k] += 1;
    });
    return counts;
  }, [active]);

  const completionRate = useMemo(() => {
    const base = records.length || 0;
    if (!base) return 0;
    return Math.round((completed.length / base) * 100);
  }, [records.length, completed.length]);

  const openSliceLabel = useMemo(() => {
    if (peer) {
      return `Open at ${myStage != null ? STAGE_LABELS[myStage - 1] || `Stage ${myStage}` : "my step"}`;
    }
    return "In progress";
  }, [peer, myStage]);

  const listTitle = useMemo(() => {
    if (slice === "dueSoon") return "Due soon (next 7 days)";
    if (slice === "overdue") return "Overdue";
    if (slice === "queue") return "My queue";
    if (slice === "completed") return "Completed (loaded)";
    if (slice === "loaded") return "Loaded (all visible)";
    return openSliceLabel;
  }, [slice, openSliceLabel]);

  const stageCounts = useMemo(() => {
    const out = new Array(STAGE_LABELS.length).fill(0);
    active.forEach((r) => {
      const st = Number(r.current_stage);
      if (Number.isFinite(st) && st >= 1 && st <= out.length) {
        out[st - 1] += 1;
      }
    });
    return out;
  }, [active]);

  const topVendors = useMemo(() => {
    const map = new Map();
    active.forEach((r) => {
      const name = r.vendor_name || r.vendor?.name || "Unknown";
      const qty = Number(r.quantity || 0);
      const curr = map.get(name) || { name, qty: 0, count: 0 };
      curr.qty += Number.isFinite(qty) ? qty : 0;
      curr.count += 1;
      map.set(name, curr);
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [active]);

  const canExport = user?.role === "gm" || user?.role === "superadmin" || user?.role === "manager";

  const shareXlsx = useCallback(async (rows, filenameBase) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export");
    const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
    const stamp = new Date().toISOString().slice(0, 10);
    const dir = await ensureDocsDir();
    const uri = `${dir}${filenameBase}_${stamp}.xlsx`;
    await FileSystem.writeAsStringAsync(uri, base64, { encoding: "base64" });
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) throw new Error("File write failed");
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Share export",
      });
    }
    // Always show where file was saved
    showSuccess("Export saved to Documents");
  }, []);

  const exportDueSoon = useCallback(async () => {
    setExportBusy(true);
    try {
      const rows = [
        ["record_number", "vendor", "due_date", "stage", "alert"],
        ...dueSoon.map((r) => [
          r.record_number || "",
          r.vendor_name || "",
          r.due_date || "",
          r.current_stage ?? "",
          (r.alert_level || "").toString(),
        ]),
      ];
      await shareXlsx(rows, "due_soon");
    } finally {
      setExportBusy(false);
    }
  }, [dueSoon, shareXlsx]);

  const exportTopVendors = useCallback(async () => {
    setExportBusy(true);
    try {
      const rows = [
        ["vendor", "records", "total_quantity"],
        ...topVendors.map((v) => [v.name, v.count, v.qty]),
      ];
      await shareXlsx(rows, "top_vendors");
    } finally {
      setExportBusy(false);
    }
  }, [topVendors, shareXlsx]);

  const deptWorkload = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      const dept = r.current_department_name || "Unassigned";
      const curr = map.get(dept) || { dept, active: 0, completed: 0, total: 0 };
      curr.total += 1;
      const isDone = String(r.alert_level || "").toLowerCase() === "completed";
      if (isDone) curr.completed += 1;
      else curr.active += 1;
      map.set(dept, curr);
    });
    return Array.from(map.values()).sort((a, b) => b.active - a.active || b.total - a.total).slice(0, 6);
  }, [records]);

  const agingBuckets = useMemo(() => {
    const buckets = [
      { key: "0-7", from: 0, to: 7, count: 0 },
      { key: "8-15", from: 8, to: 15, count: 0 },
      { key: "16-30", from: 16, to: 30, count: 0 },
      { key: "30+", from: 31, to: 100000, count: 0 },
    ];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    active.forEach((r) => {
      const entry = asDate(r.entry_date);
      if (!entry) return;
      entry.setHours(0, 0, 0, 0);
      const days = Math.max(0, Math.floor((today.getTime() - entry.getTime()) / 86400000));
      const b = buckets.find((x) => days >= x.from && days <= x.to);
      if (b) b.count += 1;
    });
    return buckets;
  }, [active]);

  const entryTrend = useMemo(() => {
    const days = 14;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bucket = new Map();
    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      bucket.set(dayKey(d), 0);
    }
    active.forEach((r) => {
      const d = asDate(r.entry_date);
      if (!d) return;
      const k = dayKey(d);
      if (bucket.has(k)) bucket.set(k, (bucket.get(k) || 0) + 1);
    });
    const rows = Array.from(bucket.entries()).map(([k, v]) => ({ day: k.slice(5), count: v }));
    const max = Math.max(1, ...rows.map((x) => x.count));
    return { rows, max };
  }, [active]);

  const kpiCards = useMemo(() => {
    if (peer) {
      return [
        { id: "queue", label: "My queue", value: String(queue.length), icon: "list-outline", slice: "queue" },
        { id: "default", label: "Open at my step", value: String(atMyStageOpen.length), icon: "git-branch-outline", slice: "default" },
        { id: "dueSoon", label: "Due soon", value: String(dueSoon.length), icon: "time-outline", slice: "dueSoon" },
        { id: "overdue", label: "Overdue", value: String(overdue.length), icon: "alert-circle-outline", slice: "overdue" },
      ];
    }
    return [
      { id: "default", label: "Active", value: String(active.length), icon: "pulse-outline", slice: "default" },
      { id: "overdue", label: "Overdue", value: String(overdue.length), icon: "alert-circle-outline", slice: "overdue" },
      { id: "queue", label: "My queue", value: String(queue.length), icon: "list-outline", slice: "queue" },
      { id: "completed", label: "Completion", value: `${completionRate}%`, icon: "checkmark-done-outline", slice: "completed" },
      { id: "loaded", label: "Loaded", value: String(records.length), icon: "cloud-download-outline", slice: "loaded" },
    ];
  }, [peer, queue.length, atMyStageOpen.length, dueSoon.length, overdue.length, active.length, completionRate, records.length]);

  const kpiRows = useMemo(() => {
    const rows = [];
    for (let i = 0; i < kpiCards.length; i += kpiColumns) {
      rows.push(kpiCards.slice(i, i + kpiColumns));
    }
    return rows;
  }, [kpiCards, kpiColumns]);

  const listNumColumns = view === "overview" && listColumns > 1 ? listColumns : 1;

  const baseList = peer ? atMyStageOpen : active;
  const listData = useMemo(() => {
    if (slice === "dueSoon") return dueSoon.slice(0, 20);
    if (slice === "overdue") return overdue.slice(0, 20);
    if (slice === "queue") return queue.slice(0, 20);
    if (slice === "completed") return completed.slice(0, 20);
    if (slice === "loaded") return records.slice(0, 20);
    return baseList.slice(0, 20);
  }, [slice, dueSoon, overdue, queue, completed, records, baseList]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <LoadingBlock message="Loading dashboard…" fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <FlatList
        data={listData}
        key={`dash-list-${listNumColumns}`}
        numColumns={listNumColumns}
        columnWrapperStyle={listNumColumns > 1 ? { gap: gridGap, paddingHorizontal: horizontalPad } : undefined}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
        }
        {...FLATLIST_PERF}
        ListHeaderComponent={
          <ContentWidth noPad>
            <ErrorBanner
              message={loadError}
              onRetry={() => {
                setLoading(true);
                void load();
              }}
            />
            <View style={[styles.headerWrap, { paddingHorizontal: horizontalPad }]}>
              <Card style={styles.headerCard} padded={false}>
                <View style={styles.headerInner}>
                  <View style={styles.heroRow}>
                    <View style={styles.brandMark}>
                      <Image source={appLogo} style={styles.brandLogo} resizeMode="cover" />
                    </View>
                    <View style={styles.brandTextCol}>
                      <Text style={styles.brandName}>Chem-Solv</Text>
                      <Text style={styles.brandSub}>INVENTORY</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("SettingsTab")}
                      style={styles.brandAvatar}
                      accessibilityRole="button"
                      accessibilityLabel="Open Settings"
                      hitSlop={10}
                    >
                      <Text style={styles.brandAvatarText}>
                        {(user?.full_name || user?.username || "U").slice(0, 2).toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.heroDivider} />

                  <View style={styles.headerTop}>
                    <View style={styles.headerTopLeft}>
                      <Text style={styles.title}>Dashboard</Text>
                      <Text style={styles.meta} numberOfLines={2}>
                        Hello {user?.full_name || user?.username || "there"}
                      </Text>
                      <View style={styles.roleRow}>
                        <Badge variant="accent">{(user?.role || "user").toString().toUpperCase()}</Badge>
                        {peer && myStage ? <Badge variant="neutral">{`S${myStage}`}</Badge> : null}
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => navigation.navigate("InAppNotifications")}
                      style={styles.notifyBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Workflow notifications"
                      hitSlop={10}
                    >
                      <Ionicons name="notifications-outline" size={22} color={theme.colors.accent} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.statusStrip}>
                    <View style={styles.statusItem}>
                      <Text style={styles.statusValue}>{active.length}</Text>
                      <Text style={styles.statusLabel}>Active</Text>
                    </View>
                    <View style={styles.statusDivider} />
                    <View style={styles.statusItem}>
                      <Text style={styles.statusValue}>{dueSoon.length}</Text>
                      <Text style={styles.statusLabel}>Due soon</Text>
                    </View>
                    <View style={styles.statusDivider} />
                    <View style={styles.statusItem}>
                      <Text style={[styles.statusValue, overdue.length ? styles.statusDanger : null]}>
                        {overdue.length}
                      </Text>
                      <Text style={styles.statusLabel}>Overdue</Text>
                    </View>
                  </View>

                  <SegmentedControl
                    value={view}
                    options={[
                      { value: "overview", label: "Overview" },
                      { value: "analytics", label: "Analytics" },
                    ]}
                    onChange={setView}
                  />
                </View>
              </Card>
            </View>

            <View style={[styles.kpiGrid, { paddingHorizontal: horizontalPad }]}>
              {kpiRows.map((row, rowIdx) => (
                <View key={`kpi-row-${rowIdx}`} style={[styles.kpiRowLine, { gap: gridGap }]}>
                  {row.map((a) => (
                    <StatCard
                      key={a.id}
                      icon={a.icon}
                      label={a.label}
                      value={a.value}
                      selected={slice === a.slice}
                      onPress={() => setSlice(a.slice)}
                      style={styles.kpiCard}
                    />
                  ))}
                  {row.length < kpiColumns
                    ? Array.from({ length: kpiColumns - row.length }).map((_, i) => (
                        <View key={`ph-${i}`} style={styles.kpiCardPlaceholder} pointerEvents="none" />
                      ))
                    : null}
                </View>
              ))}
            </View>

            <View style={styles.sectionWrap}>
              <SectionHeader
                title={view === "overview" ? listTitle : "At-a-glance analytics"}
                right={
                  <View style={styles.sectionActions}>
                    {view === "overview" ? (
                      <TouchableOpacity onPress={() => setSlice("default")} style={styles.linkBtn}>
                        <Text style={styles.link}>Reset slice</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canExport ? (
                      <TouchableOpacity onPress={() => void exportDueSoon()} style={styles.linkBtn} disabled={exportBusy}>
                        <Text style={styles.link}>{exportBusy ? "Exporting..." : "Export due soon"}</Text>
                      </TouchableOpacity>
                    ) : null}
                    {canExport ? (
                      <TouchableOpacity onPress={() => void exportTopVendors()} style={styles.linkBtn} disabled={exportBusy}>
                        <Text style={styles.link}>{exportBusy ? "Exporting..." : "Export top vendors"}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity onPress={() => navigation.navigate("RecordsTab")} style={styles.linkBtn}>
                      <Text style={styles.link}>Open records</Text>
                    </TouchableOpacity>
                  </View>
                }
              />

              {view === "analytics" ? (
                <View style={[styles.analyticsCard, { marginHorizontal: horizontalPad }]}>
                  <View style={styles.analyticsTitleRow}>
                    <View style={styles.analyticsTitleIcon}>
                      <Ionicons name="analytics-outline" size={16} color={theme.colors.accent} />
                    </View>
                    <Text style={styles.analyticsTitle}>Analytics</Text>
                    <View style={{ flex: 1 }} />
                    <View style={styles.analyticsPill}>
                      <Text style={styles.analyticsPillText}>{`Loaded ${records.length}`}</Text>
                    </View>
                  </View>

                  <Text style={styles.analyticsSub}>Alert mix (active)</Text>
                  {Object.entries(alertCounts).map(([k, v]) => {
                    const total = Math.max(1, active.length);
                    const pct = Math.round((v / total) * 100);
                    const color =
                      k === "red"
                        ? theme.colors.danger
                        : k === "orange"
                          ? theme.colors.warning
                          : k === "yellow"
                            ? theme.colors.warning
                            : theme.colors.success;
                    return (
                      <View key={k} style={styles.alertRow}>
                        <Text style={styles.alertKey}>{k.toUpperCase()}</Text>
                        <View style={styles.alertBarTrack}>
                          <View style={[styles.alertBarFill, { width: `${pct}%`, backgroundColor: color }]} />
                        </View>
                        <Text style={styles.alertVal}>{v}</Text>
                      </View>
                    );
                  })}

                  <View style={styles.divider} />

                  <Text style={styles.analyticsSub}>Stage distribution (active)</Text>
                  {stageCounts.map((v, idx) => {
                    const total = Math.max(1, active.length);
                    const pct = Math.round((v / total) * 100);
                    const label = STAGE_LABELS[idx] || `Stage ${idx + 1}`;
                    return (
                      <View key={label} style={styles.alertRow}>
                        <Text style={styles.alertKey}>{`S${idx + 1}`}</Text>
                        <View style={styles.alertBarTrack}>
                          <View style={[styles.alertBarFill, { width: `${pct}%`, backgroundColor: theme.colors.accent }]} />
                        </View>
                        <Text style={styles.alertVal}>{v}</Text>
                      </View>
                    );
                  })}

                  <View style={styles.divider} />

                  <Text style={styles.analyticsSub}>Entry trend (last 14 days)</Text>
                  <View style={styles.trendRow}>
                    {entryTrend.rows.map((r) => (
                      <View key={r.day} style={styles.trendCol}>
                        <View
                          style={[
                            styles.trendBar,
                            { height: Math.max(3, Math.round((r.count / entryTrend.max) * 36)) },
                          ]}
                        />
                        <Text style={styles.trendLabel}>{r.day}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.analyticsSub}>Top vendors by volume (active)</Text>
                  {topVendors.length ? (
                    topVendors.map((v) => {
                      const max = Math.max(1, ...topVendors.map((x) => x.qty));
                      const pct = Math.round((v.qty / max) * 100);
                      return (
                        <View key={v.name} style={styles.alertRow}>
                          <Text style={[styles.alertKey, { width: 70 }]} numberOfLines={1}>
                            {v.name}
                          </Text>
                          <View style={styles.alertBarTrack}>
                            <View style={[styles.alertBarFill, { width: `${pct}%`, backgroundColor: theme.colors.accentHover }]} />
                          </View>
                          <Text style={styles.alertVal}>{v.count}</Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.analyticsHint}>No vendor volume in the current slice.</Text>
                  )}

                  <View style={styles.divider} />

                  <Text style={styles.analyticsSub}>Department workload</Text>
                  {deptWorkload.length ? (
                    deptWorkload.map((d) => {
                      const max = Math.max(1, ...deptWorkload.map((x) => x.active));
                      const pct = Math.round((d.active / max) * 100);
                      return (
                        <View key={d.dept} style={styles.alertRow}>
                          <Text style={[styles.alertKey, { width: 70 }]} numberOfLines={1}>
                            {d.dept}
                          </Text>
                          <View style={styles.alertBarTrack}>
                            <View
                              style={[
                                styles.alertBarFill,
                                { width: `${pct}%`, backgroundColor: theme.colors.accent },
                              ]}
                            />
                          </View>
                          <Text style={styles.alertVal}>{d.active}</Text>
                        </View>
                      );
                    })
                  ) : (
                    <Text style={styles.analyticsHint}>No departments found.</Text>
                  )}

                  <View style={styles.divider} />

                  <Text style={styles.analyticsSub}>Aging buckets (active)</Text>
                  {agingBuckets.map((b) => {
                    const max = Math.max(1, ...agingBuckets.map((x) => x.count));
                    const pct = Math.round((b.count / max) * 100);
                    return (
                      <View key={b.key} style={styles.alertRow}>
                        <Text style={styles.alertKey}>{b.key}</Text>
                        <View style={styles.alertBarTrack}>
                          <View style={[styles.alertBarFill, { width: `${pct}%`, backgroundColor: theme.colors.warning }]} />
                        </View>
                        <Text style={styles.alertVal}>{b.count}</Text>
                      </View>
                    );
                  })}

                  <Text style={styles.analyticsHint}>
                    Mobile-friendly summaries based on loaded records (up to 120).
                  </Text>
                </View>
              ) : null}
            </View>
          </ContentWidth>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.row,
              listNumColumns > 1
                ? { marginHorizontal: 0, flex: 1, minWidth: 0 }
                : { marginHorizontal: horizontalPad },
            ]}
            onPress={() => {
              const target = slice === "queue" ? "RecordDetail" : "RecordDetail";
              navigation.getParent()?.navigate(target, {
                recordId: String(item.id),
                title: item.record_number,
              });
            }}
          >
            <View style={styles.rowTop}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.record_number || "-"}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {(item.vendor_name || "-") + ` / Stage ${item.current_stage ?? "-"}`}
                </Text>
              </View>
              {(() => {
                const lvl = alertLevelOf(item) || "green";
                const c = badgeColor(lvl);
                return (
                  <View style={[styles.alertBadge, { backgroundColor: c.bg, borderColor: c.border }]}>
                    <Text style={[styles.alertBadgeText, { color: c.fg }]}>
                      {String(lvl).toUpperCase()}
                    </Text>
                  </View>
                );
              })()}
            </View>
            <View style={styles.rowFooter}>
              <Text style={styles.rowFootText} numberOfLines={1}>
                {item.due_date ? `Due ${item.due_date}` : "No due date"}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(15,23,42,0.35)" />
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View
            style={[
              styles.row,
              styles.emptyCard,
              { marginHorizontal: horizontalPad },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.emptyText}>
              {slice === "queue" ? "Nothing in your queue." : "No records in this slice."}
            </Text>
            <Text style={styles.emptySub}>Pull to refresh.</Text>
          </View>
        }
        contentContainerStyle={[
          styles.listPad,
          { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerWrap: { paddingTop: theme.space.md, paddingBottom: theme.space.xs },
  headerCard: { overflow: "hidden", borderRadius: theme.radius.xl },
  headerInner: { padding: theme.space.md, gap: 14 },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 2,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted,
  },
  brandTextCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  brandLogo: {
    width: "100%",
    height: "100%",
  },
  heroDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
  },
  brandName: { fontSize: 17, lineHeight: 21, fontWeight: "700", color: theme.colors.textBright },
  brandSub: { marginTop: 2, fontSize: 10, letterSpacing: 1.2, fontWeight: "600", color: theme.colors.textMuted },
  notifyBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  brandAvatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.tintSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  brandAvatarText: { fontSize: 12, fontWeight: "900", color: theme.colors.textBright },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.sm,
  },
  headerTopLeft: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: theme.colors.textBright },
  meta: { marginTop: 2, fontSize: 13, lineHeight: 18, color: theme.colors.text, fontWeight: "700" },
  roleRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  statusStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bgTint,
    overflow: "hidden",
  },
  statusItem: {
    flex: 1,
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  statusDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
  statusValue: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "900",
    color: theme.colors.textBright,
    includeFontPadding: false,
  },
  statusDanger: { color: theme.colors.danger },
  statusLabel: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 14,
    color: theme.colors.text,
    fontWeight: "800",
  },
  roleChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.22)",
  },
  roleChipAlt: {
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderColor: "rgba(34, 197, 94, 0.18)",
  },
  roleChipText: { color: theme.colors.textBright, fontWeight: "900", fontSize: 11 },
  sectionWrap: { paddingBottom: 4, paddingTop: 2 },
  quickActions: { gap: 8, alignItems: "flex-end" },
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(255,255,255,0.8)",
  },
  iconBtnText: { fontSize: 12, fontWeight: "900", color: theme.colors.textBright },
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segmentBtnOn: { backgroundColor: theme.colors.accent },
  segmentText: { fontSize: 12, fontWeight: "900", color: theme.colors.textBright },
  segmentTextOn: { color: "#fff" },
  kpiGrid: { paddingTop: theme.space.xs, paddingBottom: theme.space.sm, gap: 10 },
  kpiRowLine: { flexDirection: "row", gap: 10 },
  kpiCard: { flex: 1, minWidth: 0 },
  kpiCardPlaceholder: { flex: 1, minWidth: 0, minHeight: 96, opacity: 0 },
  // KPI cards moved to `components/ui/StatCard.jsx` (keep dashboard styles lean).
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: theme.colors.textBright },
  sectionActions: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "flex-end", maxWidth: 420 },
  linkBtn: {
    minHeight: 32,
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accentSoft,
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.12)",
  },
  link: { fontSize: 11, lineHeight: 14, fontWeight: "900", color: theme.colors.accentHover },
  analyticsCard: {
    marginBottom: 10,
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.md,
    gap: 9,
    ...theme.shadow.sm,
  },
  analyticsTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  analyticsTitleIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: theme.colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  analyticsTitle: { fontSize: 15, lineHeight: 19, fontWeight: "900", color: theme.colors.textBright },
  analyticsPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  analyticsPillText: { fontSize: 11, fontWeight: "900", color: theme.colors.textBright },
  analyticsSub: { marginTop: 9, fontSize: 13, lineHeight: 17, fontWeight: "900", color: theme.colors.textBright, opacity: 0.88 },
  analyticsHint: { fontSize: 12, color: theme.colors.text, lineHeight: 17, marginTop: 4, fontWeight: "700" },
  divider: { height: 1, backgroundColor: theme.colors.border, marginTop: 10, marginBottom: 2 },
  alertRow: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 8 },
  alertKey: { width: 70, fontSize: 11, lineHeight: 14, fontWeight: "900", color: theme.colors.textBright },
  alertBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: "rgba(15, 23, 42, 0.08)",
    borderRadius: 99,
    overflow: "hidden",
  },
  alertBarFill: { height: 10, backgroundColor: "#22c55e" },
  alertVal: { width: 32, textAlign: "right", fontSize: 12, lineHeight: 15, fontWeight: "900", color: theme.colors.textBright },
  trendRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 8, flexWrap: "nowrap" },
  trendCol: { alignItems: "center", flex: 1, minWidth: 18 },
  trendBar: { width: 14, borderRadius: 6, backgroundColor: theme.colors.accent },
  trendLabel: { marginTop: 4, fontSize: 9, color: theme.colors.text },
  listPad: { paddingBottom: 22 },
  row: {
    backgroundColor: theme.colors.surfaceStrong,
    marginVertical: 5,
    padding: theme.space.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 10,
    ...theme.shadow.sm,
  },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rowTitle: { fontSize: 16, lineHeight: 20, fontWeight: "900", color: theme.colors.textBright },
  rowSub: { marginTop: 3, fontSize: 13, lineHeight: 17, color: theme.colors.text, fontWeight: "700" },
  alertBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  alertBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: "900" },
  rowFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowFootText: { flex: 1, fontSize: 12, lineHeight: 16, color: theme.colors.text, fontWeight: "800" },
  emptyCard: {
    minHeight: 92,
    justifyContent: "center",
  },
  emptyText: { color: theme.colors.textBright, fontSize: 14, fontWeight: "800" },
  emptySub: { color: theme.colors.text, fontSize: 13, fontWeight: "700" },
});
