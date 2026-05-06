import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";

export function RecordsScreen({ navigation }) {
  const { api, logout, refreshUser, user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!api) return;
    const res = await api.records.getAll({ page_size: 50, exclude_completed: true });
    if (res.ok) {
      const list = Array.isArray(res.data?.results) ? res.data.results : [];
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

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Records</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {user?.full_name || user?.username || "—"}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate("Queue")}>
          <Text style={styles.headerBtnText}>Queue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate("Settings")}>
          <Text style={styles.headerBtnText}>API</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerBtnGhost} onPress={() => void logout().then(() => navigation.reset({
          index: 0,
          routes: [{ name: "Login" }],
        }))}>
          <Text style={styles.headerBtnGhostText}>Out</Text>
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
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              onPress={() =>
                navigation.navigate("RecordDetail", {
                  recordId: String(item.id),
                  title: item.record_number,
                })
              }
            >
              <Text style={styles.rowTitle}>{item.record_number}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {item.vendor_name || "—"} · Stage {item.current_stage} · {(item.alert_level || "green").toString()}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No open records in this slice. Pull to refresh.</Text>
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
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
    gap: 6,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  meta: {
    fontSize: 12,
    color: "#64748b",
  },
  headerBtn: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  headerBtnText: {
    color: "#166534",
    fontWeight: "700",
    fontSize: 12,
  },
  headerBtnGhost: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  headerBtnGhostText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 12,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
});
