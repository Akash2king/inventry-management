import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../AuthContext.jsx";
import { STAGE_LABELS } from "../../src/utils/stageLabels.js";
import { canActForward, canActReturn, stageForRole } from "../../src/utils/permissions.js";

export function QueueScreen({ navigation }) {
  const { api, user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const stage = stageForRole(user?.role);
  const stageLabel = useMemo(() => {
    if (!stage || stage < 1) return "";
    return STAGE_LABELS[stage - 1] || `Stage ${stage}`;
  }, [stage]);

  const load = useCallback(async () => {
    if (!api) return;
    setError("");
    const res = await api.workflow.getQueue();
    if (res.ok && Array.isArray(res.data)) {
      setQueue(res.data);
    } else {
      setQueue([]);
      setError(res.error || "Could not load queue.");
    }
    setLoading(false);
    setRefreshing(false);
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const tick = async () => {
        if (cancelled) return;
        await load().catch(() => {});
      };
      // refresh on focus + every 20s while focused
      void tick();
      const id = setInterval(() => void tick(), 20000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, [load]),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>My queue</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {user?.full_name || user?.username || "—"}
          </Text>
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.navigate("RecordsTab")}>
          <Text style={styles.headerBtnText}>Records</Text>
        </TouchableOpacity>
      </View>
      {stage ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Your queue shows records at stage {stage} — {stageLabel}.
          </Text>
          <Text style={styles.bannerSub}>This screen refreshes every 20 seconds while you stay here.</Text>
        </View>
      ) : (
        <View style={[styles.banner, styles.bannerMuted]}>
          <Text style={styles.bannerText}>No pipeline stage assigned to your account.</Text>
          <Text style={styles.bannerSub}>Ask GM to link you to a department.</Text>
        </View>
      )}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(item) => String(item.id)}
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
            <View style={styles.row}>
              <TouchableOpacity
                onPress={() =>
                  navigation.getParent()?.navigate("RecordDetail", {
                    recordId: String(item.id),
                    title: item.record_number,
                  })
                }
              >
                <Text style={styles.rowTitle}>{item.record_number}</Text>
                <Text style={styles.rowSub} numberOfLines={2}>
                  {(item.vendor_name || "—") +
                    ` · Stage ${item.current_stage}` +
                    (item.current_department_name ? ` · ${item.current_department_name}` : "")}
                </Text>
                <View style={styles.badges}>
                  <Text style={[styles.badge, styles.badgeNeutral]}>
                    {(item.alert_level || "green").toString().toUpperCase()}
                  </Text>
                  {item.is_locked ? (
                    <Text style={[styles.badge, styles.badgeDone]}>LOCKED</Text>
                  ) : null}
                </View>
              </TouchableOpacity>

              {!item.is_locked ? (
                <View style={styles.quickActions}>
                  {canActForward(item, user) ? (
                    <TouchableOpacity
                      style={styles.quickPrimary}
                      onPress={() =>
                        navigation.getParent()?.navigate("RecordDetail", {
                          recordId: String(item.id),
                          title: item.record_number,
                          autoOpen: "forward",
                        })
                      }
                    >
                      <Text style={styles.quickPrimaryText}>Forward</Text>
                    </TouchableOpacity>
                  ) : null}
                  {canActReturn(item, user) ? (
                    <TouchableOpacity
                      style={styles.quickDanger}
                      onPress={() =>
                        navigation.getParent()?.navigate("RecordDetail", {
                          recordId: String(item.id),
                          title: item.record_number,
                          autoOpen: "return",
                        })
                      }
                    >
                      <Text style={styles.quickPrimaryText}>Return</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {error ? error : "Nothing in your queue. Pull to refresh."}
            </Text>
          }
          contentContainerStyle={queue.length === 0 ? styles.emptyWrap : styles.listPad}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
    gap: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b" },
  headerBtn: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerBtnText: { color: "#166534", fontWeight: "900", fontSize: 12 },
  banner: {
    margin: 12,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    gap: 4,
  },
  bannerMuted: {
    backgroundColor: "rgba(254, 243, 199, 0.7)",
    borderColor: "rgba(180, 120, 0, 0.25)",
  },
  bannerText: { color: "#0f172a", fontWeight: "900", fontSize: 13 },
  bannerSub: { color: "#64748b", fontWeight: "700", fontSize: 12 },
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
    fontWeight: "900",
    color: "#0f172a",
  },
  rowSub: { marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 18 },
  badges: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
  },
  badgeNeutral: { backgroundColor: "#e2e8f0", color: "#0f172a" },
  badgeDone: { backgroundColor: "#dcfce7", color: "#166534" },
  quickActions: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  quickPrimary: {
    backgroundColor: "#15803d",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  quickDanger: {
    backgroundColor: "#b91c1c",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  quickPrimaryText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  empty: { textAlign: "center", color: "#64748b", fontSize: 14 },
});
