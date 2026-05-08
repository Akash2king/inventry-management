import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../AuthContext.jsx";

const PAGE_SIZE = 50;
const ACTIONS = [
  "",
  "CREATE",
  "EDIT",
  "FORWARD",
  "RETURN",
  "APPROVE",
  "LOGIN",
  "LOGOUT",
  "EXPORT",
  "ALERT_SENT",
  "DELETE",
];

function formatTs(isoTs) {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function toDay(isoTs) {
  const d = new Date(isoTs);
  if (Number.isNaN(d.getTime())) return "Unknown date";
  return d.toISOString().slice(0, 10);
}

function groupRows(rows, mode) {
  const map = new Map();
  for (const r of rows) {
    let k = "Other";
    if (mode === "day") k = toDay(r.timestamp);
    else if (mode === "action") k = r.action || "Unknown action";
    else if (mode === "user") k = r.username ? `@${r.username}` : "System";
    const arr = map.get(k) || [];
    arr.push(r);
    map.set(k, arr);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}

export function AuditLogsScreen() {
  const { api, user } = useAuth();
  const canView = user && (user.role === "manager" || user.role === "gm" || user.role === "superadmin");

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(0);

  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [groupBy, setGroupBy] = useState("day");

  const totalPages = useMemo(() => Math.max(1, Math.ceil((count || 0) / PAGE_SIZE)), [count]);
  const groups = useMemo(() => groupRows(rows, groupBy), [rows, groupBy]);

  const load = useCallback(
    async (mode) => {
      if (!api || !canView) return;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await api.audit.getLogs(
          {
            page,
            page_size: PAGE_SIZE,
            action: action || undefined,
            search: search || undefined,
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
          },
          undefined,
        );
        if (!res.ok) throw new Error(res.error || "Could not load audit logs");
        const results = Array.isArray(res.data?.results) ? res.data.results : Array.isArray(res.data) ? res.data : [];
        setRows(results);
        setCount(Number(res.data?.count || results.length || 0));
      } catch (e) {
        setError(e?.message || "Could not load audit logs");
        setRows([]);
        setCount(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, canView, page, action, search, dateFrom, dateTo],
  );

  useFocusEffect(
    useCallback(() => {
      load("init").catch(() => {});
    }, [load]),
  );

  if (!canView) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.wrap}>
          <Text style={styles.title}>Audit Logs</Text>
          <Text style={styles.help}>Only Manager and GM can view audit logs.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.head}>
          <Text style={styles.title}>Audit Logs</Text>
          <TouchableOpacity style={styles.btnGhost} onPress={() => void load("refresh")}>
            <Text style={styles.btnGhostText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sub}>Filters</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Action</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ACTIONS.map((a) => {
                const activeChip = action === a;
                return (
                  <TouchableOpacity
                    key={a || "all"}
                    style={[styles.chip, activeChip && styles.chipActive]}
                    onPress={() => {
                      setAction(a);
                      setPage(1);
                    }}
                  >
                    <Text style={[styles.chipText, activeChip && styles.chipTextActive]}>{a || "All"}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Group by</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { id: "day", label: "Day" },
                { id: "action", label: "Action" },
                { id: "user", label: "User" },
              ].map((g) => {
                const on = groupBy === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.chip, on && styles.chipActive]}
                    onPress={() => setGroupBy(g.id)}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextActive]}>{g.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Text style={styles.label}>Date from (YYYY-MM-DD)</Text>
          <TextInput value={dateFrom} onChangeText={(t) => (setDateFrom(t), setPage(1))} style={styles.input} placeholder="2026-01-01" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Date to (YYYY-MM-DD)</Text>
          <TextInput value={dateTo} onChangeText={(t) => (setDateTo(t), setPage(1))} style={styles.input} placeholder="2026-01-31" placeholderTextColor="#94a3b8" />

          <Text style={styles.label}>Search</Text>
          <TextInput
            value={search}
            onChangeText={(t) => (setSearch(t), setPage(1))}
            style={styles.input}
            placeholder="Action, description, user, record number…"
            placeholderTextColor="#94a3b8"
          />

          <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={styles.btnGhost}
              onPress={() => {
                setAction("");
                setSearch("");
                setDateFrom("");
                setDateTo("");
                setGroupBy("day");
                setPage(1);
              }}
            >
              <Text style={styles.btnGhostText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => void load("refresh")}>
              <Text style={styles.btnPrimaryText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: 40 }}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {groups.map((g) => (
              <View key={g.group} style={styles.card}>
                <Text style={styles.sub}>
                  {g.group} ({g.items.length})
                </Text>
                {g.items.map((r) => (
                  <View key={String(r.id)} style={styles.logRow}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
                      <Text style={styles.logAction}>{r.action || "—"}</Text>
                      <Text style={styles.logTime}>{formatTs(r.timestamp)}</Text>
                    </View>
                    <Text style={styles.logMeta}>
                      {(r.username ? `@${r.username}` : "System") +
                        (r.record_number ? ` • Record ${r.record_number}` : "")}
                    </Text>
                    <Text style={styles.logDesc}>{r.description || "—"}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        <View style={styles.pager}>
          <TouchableOpacity
            style={[styles.btnGhost, page <= 1 && { opacity: 0.5 }]}
            disabled={page <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
          >
            <Text style={styles.btnGhostText}>Previous</Text>
          </TouchableOpacity>
          <Text style={styles.pagerText}>
            Page {page} of {totalPages}
          </Text>
          <TouchableOpacity
            style={[styles.btnGhost, page >= totalPages && { opacity: 0.5 }]}
            disabled={page >= totalPages}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            <Text style={styles.btnGhostText}>Next</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  wrap: { flex: 1, padding: 16, gap: 10 },
  scroll: { padding: 16, paddingBottom: 28, gap: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  help: { fontSize: 14, color: "#475569" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 8,
  },
  sub: { fontSize: 13, fontWeight: "900", color: "#0f172a", opacity: 0.85 },
  row: { gap: 8 },
  label: { marginTop: 6, fontSize: 12, fontWeight: "800", color: "#334155" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" },
  chipText: { fontSize: 12, fontWeight: "800", color: "#0f172a" },
  chipTextActive: { color: "#fff" },
  btnPrimary: { flex: 1, backgroundColor: "#15803d", paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnGhost: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center" },
  btnGhostText: { color: "#334155", fontWeight: "900" },
  error: { padding: 12, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" },
  errorText: { color: "#b91c1c", fontWeight: "800" },
  logRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", gap: 2 },
  logAction: { fontSize: 13, fontWeight: "900", color: "#0f172a" },
  logTime: { fontSize: 11, color: "#64748b", fontWeight: "800" },
  logMeta: { fontSize: 12, color: "#334155", fontWeight: "700" },
  logDesc: { fontSize: 12, color: "#475569" },
  pager: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6, gap: 10 },
  pagerText: { fontSize: 12, color: "#475569", fontWeight: "800" },
});

