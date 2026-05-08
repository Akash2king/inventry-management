import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";
import { STAGE_LABELS } from "../../src/utils/stageLabels.js";
import { stageForRole } from "../../src/utils/permissions.js";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";

function isPeerRole(role) {
  return role === "storeman" || role === "treatment" || role === "admin";
}

function kpi(label, value) {
  return { label, value: String(value ?? "—") };
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState("overview"); // overview | analytics
  const [slice, setSlice] = useState("default"); // default | dueSoon | overdue | queue | completed | loaded
  const [queue, setQueue] = useState([]);
  const [records, setRecords] = useState([]);
  const [exportBusy, setExportBusy] = useState(false);

  const load = useCallback(async () => {
    if (!api) return;
    const [q, r] = await Promise.all([
      api.workflow.getQueue(),
      api.records.getAll({ page_size: 120 }),
    ]);
    if (q.ok && Array.isArray(q.data)) setQueue(q.data);
    else setQueue([]);
    if (r.ok) {
      const list = Array.isArray(r.data?.results) ? r.data.results : [];
      setRecords(list);
    } else {
      setRecords([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    await load();
  };

  const role = user?.role || "";
  const peer = isPeerRole(role);
  const myStage = stageForRole(role);

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
    Alert.alert("Saved", `Saved to Documents:\n${uri}`);
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

  const baseList = peer ? atMyStageOpen : active;
  const listData = useMemo(() => {
    if (slice === "dueSoon") return dueSoon.slice(0, 20);
    if (slice === "overdue") return overdue.slice(0, 20);
    if (slice === "queue") return queue.slice(0, 20);
    if (slice === "completed") return completed.slice(0, 20);
    if (slice === "loaded") return records.slice(0, 20);
    return baseList.slice(0, 20);
  }, [slice, dueSoon, overdue, queue, completed, baseList]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
      <FlatList
        data={listData}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            <View style={styles.headerWrap}>
              <View style={styles.headerCard}>
                <View style={styles.headerTop}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title}>Dashboard</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      Hello {user?.full_name || user?.username || "there"}
                    </Text>
                    <View style={styles.roleRow}>
                      <View style={styles.roleChip}>
                        <Text style={styles.roleChipText}>{(user?.role || "user").toString().toUpperCase()}</Text>
                      </View>
                      {peer && myStage ? (
                        <View style={[styles.roleChip, styles.roleChipAlt]}>
                          <Text style={styles.roleChipText}>{`S${myStage}`}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.quickActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("QueueTab")}>
                      <Ionicons name="list-outline" size={18} color="#0f172a" />
                      <Text style={styles.iconBtnText}>Queue</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("RecordsTab")}>
                      <Ionicons name="document-text-outline" size={18} color="#0f172a" />
                      <Text style={styles.iconBtnText}>Records</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate("SettingsTab")}>
                      <Ionicons name="settings-outline" size={18} color="#0f172a" />
                      <Text style={styles.iconBtnText}>Settings</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.segment}>
                  <TouchableOpacity
                    style={[styles.segmentBtn, view === "overview" && styles.segmentBtnOn]}
                    onPress={() => setView("overview")}
                  >
                    <Text style={[styles.segmentText, view === "overview" && styles.segmentTextOn]}>Overview</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.segmentBtn, view === "analytics" && styles.segmentBtnOn]}
                    onPress={() => setView("analytics")}
                  >
                    <Text style={[styles.segmentText, view === "analytics" && styles.segmentTextOn]}>Analytics</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.kpiRow}>
              {kpiCards.map((x) => {
                const selected = slice === x.slice;
                return (
                  <TouchableOpacity
                    key={x.id}
                    style={[styles.kpiCard, selected && styles.kpiCardOn]}
                    onPress={() => setSlice(x.slice)}
                  >
                    <View style={styles.kpiTop}>
                      <View style={[styles.kpiIconWrap, selected && styles.kpiIconWrapOn]}>
                        <Ionicons name={x.icon} size={16} color={selected ? "#fff" : "#0f172a"} />
                      </View>
                      <Text style={[styles.kpiLabel, selected && styles.kpiLabelOn]} numberOfLines={1}>
                        {x.label}
                      </Text>
                    </View>
                    <Text style={[styles.kpiValue, selected && styles.kpiValueOn]}>{x.value}</Text>
                    {selected ? (
                      <View style={styles.kpiSelectedPill}>
                        <Text style={styles.kpiSelectedPillText}>Showing</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{view === "overview" ? listTitle : "At-a-glance analytics"}</Text>
              <View style={styles.sectionActions}>
                {view === "overview" ? (
                  <TouchableOpacity onPress={() => setSlice("default")} style={styles.linkBtn}>
                    <Text style={styles.link}>Reset slice</Text>
                  </TouchableOpacity>
                ) : null}
                {canExport ? (
                  <TouchableOpacity
                    onPress={() => void exportDueSoon()}
                    style={styles.linkBtn}
                    disabled={exportBusy}
                  >
                    <Text style={styles.link}>{exportBusy ? "Exporting…" : "Export due soon"}</Text>
                  </TouchableOpacity>
                ) : null}
                {canExport ? (
                  <TouchableOpacity
                    onPress={() => void exportTopVendors()}
                    style={styles.linkBtn}
                    disabled={exportBusy}
                  >
                    <Text style={styles.link}>{exportBusy ? "Exporting…" : "Export top vendors"}</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity onPress={() => navigation.navigate("RecordsTab")} style={styles.linkBtn}>
                  <Text style={styles.link}>Open records</Text>
                </TouchableOpacity>
              </View>
            </View>

            {view === "analytics" ? (
              <View style={styles.analyticsCard}>
                <View style={styles.analyticsTitleRow}>
                  <Ionicons name="analytics-outline" size={16} color="#0f172a" />
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
                      ? "#ef4444"
                      : k === "orange"
                        ? "#f97316"
                        : k === "yellow"
                          ? "#eab308"
                          : "#22c55e";
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
                        <View style={[styles.alertBarFill, { width: `${pct}%`, backgroundColor: "#38bdf8" }]} />
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
                          <View style={[styles.alertBarFill, { width: `${pct}%`, backgroundColor: "#a78bfa" }]} />
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
                          <View style={[styles.alertBarFill, { width: `${pct}%`, backgroundColor: "#0ea5e9" }]} />
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
                        <View style={[styles.alertBarFill, { width: `${pct}%`, backgroundColor: "#f59e0b" }]} />
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
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
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
                  {item.record_number || "—"}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {(item.vendor_name || "—") + ` · Stage ${item.current_stage ?? "—"}`}
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
          <Text style={styles.empty}>
            {slice === "queue"
              ? "Nothing in your queue. Pull to refresh."
              : "No records in this slice. Pull to refresh."}
          </Text>
        }
        contentContainerStyle={listData.length === 0 ? styles.emptyWrap : styles.listPad}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerWrap: { padding: 12, paddingBottom: 4 },
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 12,
  },
  headerTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b" },
  roleRow: { flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" },
  roleChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(14,165,233,0.12)",
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.20)",
  },
  roleChipAlt: {
    backgroundColor: "rgba(16,185,129,0.12)",
    borderColor: "rgba(16,185,129,0.20)",
  },
  roleChipText: { color: "#0f172a", fontWeight: "900", fontSize: 11 },
  quickActions: { gap: 8, alignItems: "flex-end" },
  iconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  iconBtnText: { fontSize: 12, fontWeight: "900", color: "#0f172a" },
  segment: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#f8fafc",
  },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  segmentBtnOn: { backgroundColor: "#0ea5e9" },
  segmentText: { fontSize: 12, fontWeight: "900", color: "#0f172a" },
  segmentTextOn: { color: "#fff" },
  kpiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    gap: 10,
  },
  kpiCard: {
    flexGrow: 1,
    flexBasis: "48%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    overflow: "hidden",
  },
  kpiCardOn: { borderColor: "rgba(14,165,233,0.55)", backgroundColor: "rgba(14,165,233,0.06)" },
  kpiTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  kpiIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  kpiIconWrapOn: { backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" },
  kpiLabel: { fontSize: 12, color: "#64748b", fontWeight: "700" },
  kpiLabelOn: { color: "#0369a1" },
  kpiValue: { marginTop: 6, fontSize: 22, color: "#0f172a", fontWeight: "900" },
  kpiValueOn: { color: "#0f172a" },
  kpiSelectedPill: {
    position: "absolute",
    right: 10,
    top: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#0ea5e9",
  },
  kpiSelectedPillText: { color: "#fff", fontWeight: "900", fontSize: 10 },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  sectionActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end", maxWidth: 200 },
  linkBtn: { paddingVertical: 6, paddingHorizontal: 6 },
  link: { fontSize: 12, fontWeight: "900", color: "#15803d" },
  analyticsCard: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 8,
  },
  analyticsTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  analyticsTitle: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  analyticsPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  analyticsPillText: { fontSize: 11, fontWeight: "900", color: "#0f172a" },
  analyticsSub: { marginTop: 8, fontSize: 12, fontWeight: "900", color: "#0f172a", opacity: 0.85 },
  analyticsHint: { fontSize: 12, color: "#64748b", lineHeight: 16, marginTop: 4 },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginTop: 10, marginBottom: 2 },
  alertRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertKey: { width: 70, fontSize: 12, fontWeight: "900", color: "#0f172a" },
  alertBarTrack: {
    flex: 1,
    height: 10,
    backgroundColor: "#e2e8f0",
    borderRadius: 99,
    overflow: "hidden",
  },
  alertBarFill: { height: 10, backgroundColor: "#22c55e" },
  alertVal: { width: 32, textAlign: "right", fontSize: 12, fontWeight: "900", color: "#0f172a" },
  trendRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 8, flexWrap: "nowrap" },
  trendCol: { alignItems: "center", width: 20 },
  trendBar: { width: 14, borderRadius: 6, backgroundColor: "#0ea5e9" },
  trendLabel: { marginTop: 4, fontSize: 9, color: "#64748b" },
  listPad: { paddingBottom: 16 },
  row: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  rowTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  rowSub: { marginTop: 3, fontSize: 13, color: "#64748b", fontWeight: "700" },
  alertBadge: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  alertBadgeText: { fontSize: 11, fontWeight: "900" },
  rowFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  rowFootText: { flex: 1, fontSize: 12, color: "#475569", fontWeight: "800" },
  emptyWrap: { flexGrow: 1, justifyContent: "center", padding: 24 },
  empty: { textAlign: "center", color: "#64748b", fontSize: 14 },
});

