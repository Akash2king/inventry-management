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

export function QueueScreen({ navigation }) {
  const { api } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!api) return;
    const res = await api.workflow.getQueue();
    if (res.ok && Array.isArray(res.data)) {
      setQueue(res.data);
    } else {
      setQueue([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            void load();
          }} />}
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
              <Text style={styles.rowSub}>
                {(item.vendor_name || "—") +
                  ` · Stage ${item.current_stage} · ${(item.alert_level || "").toString()}`}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>Nothing in your queue. Pull to refresh.</Text>
          }
          contentContainerStyle={queue.length === 0 ? styles.emptyWrap : styles.listPad}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listPad: { paddingVertical: 8 },
  emptyWrap: { flexGrow: 1, justifyContent: "center", padding: 24 },
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
  rowSub: { marginTop: 4, fontSize: 13, color: "#64748b" },
  empty: { textAlign: "center", color: "#64748b", fontSize: 14 },
});
