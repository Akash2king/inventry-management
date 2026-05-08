import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";

function formatTs(isoTs) {
  try {
    const d = new Date(isoTs);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function actionLabel(t) {
  if (t?.transition_type === "return") return "Returned";
  if (t?.to_stage === 5 && t?.from_stage === 5) return "Final approval";
  return "Forwarded";
}

function actorLabel(t) {
  const name = String(t?.transitioned_by_name || "").trim();
  const un = String(t?.transitioned_by_username || "").trim();
  if (name && un && name !== un) return `${name} (@${un})`;
  if (name) return name;
  if (un) return `@${un}`;
  return "—";
}

export function WorkflowTimelineScreen({ route }) {
  const recordId = route.params?.recordId ? String(route.params.recordId) : "";
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!api || !recordId) return;
    const tr = await api.workflow.getTransitions(recordId);
    if (tr.ok && Array.isArray(tr.data)) {
      setRows(tr.data.slice(0).reverse()); // newest first
    } else {
      setRows([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [api, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <FlatList
        data={rows}
        keyExtractor={(item, idx) => String(item.id || idx)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>
              {actionLabel(item)} · Stage {item.from_stage}→{item.to_stage}
            </Text>
            <Text style={styles.meta}>
              {actorLabel(item)} · {formatTs(item.timestamp)}
            </Text>
            {item.note ? <Text style={styles.note}>{String(item.note)}</Text> : null}
            <Text style={styles.dept} numberOfLines={2}>
              {(item.from_department_name || "—") + " → " + (item.to_department_name || "—")}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No transitions yet.</Text>}
        contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.listPad}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listPad: { paddingVertical: 10 },
  card: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 6,
  },
  title: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b" },
  note: { fontSize: 12, color: "#334155", lineHeight: 16 },
  dept: { fontSize: 12, color: "#0f172a", opacity: 0.75 },
  emptyWrap: { flexGrow: 1, justifyContent: "center", padding: 24 },
  empty: { textAlign: "center", color: "#64748b", fontSize: 14 },
});

