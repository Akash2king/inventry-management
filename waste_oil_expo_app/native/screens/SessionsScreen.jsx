import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";
import { theme } from "../theme.js";
import { useResponsive } from "../utils/responsive.js";

function formatTs(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function clientLabel(kind) {
  const m = { tauri: "Desktop", expo: "Mobile", web: "Web", unknown: "Unknown" };
  return m[kind] || kind || "—";
}

export function SessionsScreen() {
  const { api } = useAuth();
  const { contentMaxWidth, horizontalPad } = useResponsive();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (mode = "load") => {
      if (!api) return;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const res = await api.auth.listSessions({ active: true });
        if (res.ok) {
          const list = Array.isArray(res.data?.results) ? res.data.results : [];
          setRows(list);
        } else {
          setRows([]);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api],
  );

  useEffect(() => {
    void load("load");
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {loading && !rows.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} />}
          contentContainerStyle={[
            styles.list,
            { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%", paddingHorizontal: horizontalPad },
          ]}
          ListEmptyComponent={<Text style={styles.empty}>No active sessions.</Text>}
          renderItem={({ item: s }) => (
            <View style={styles.card}>
              <Text style={styles.title}>{s.device_label || "—"}</Text>
              <Text style={styles.meta}>{s.platform || ""}</Text>
              <Text style={styles.meta}>
                {clientLabel(s.client_kind)} · {s.ip_address || "—"}
              </Text>
              <Text style={styles.meta}>Signed in {formatTs(s.created_at)}</Text>
              <Text style={styles.meta}>Last active {formatTs(s.last_seen_at)}</Text>
              {s.is_current ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>This device</Text>
                </View>
              ) : null}
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { paddingVertical: 16, gap: 12 },
  empty: { textAlign: "center", opacity: 0.7, marginTop: 24 },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  title: { fontSize: 17, fontWeight: "700", color: theme.colors.textBright },
  meta: { marginTop: 4, fontSize: 14, color: theme.colors.text },
  badge: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(22, 163, 74, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#15803d" },
});
