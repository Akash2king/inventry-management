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
import { theme } from "../theme.js";
import { Card, IconButton, SectionHeader } from "../components/ui/index.js";
import { formatDate, formatQty, slaTotalDays } from "../../src/utils/formatters.js";

const QUEUE_COPY = {
  storeman: { title: "Stock Entry Queue", forward: "Forward", return: "Return" },
  treatment: { title: "Treatment Verification Queue", forward: "Verify & Forward", return: "Return to Store Man" },
  admin: { title: "Admin Validation Queue", forward: "Validate & Forward", return: "Return to Treatment" },
  manager: { title: "Manager Approval Queue", forward: "Approve to GM", return: "Return to Admin" },
  gm: { title: "Final Approval Queue", forward: "Final Approve", return: "Return to Manager" },
  superadmin: { title: "Final Approval Queue", forward: "Final Approve", return: "Return to Manager" },
};

export function QueueScreen({ navigation }) {
  const { api, user } = useAuth();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const copy = QUEUE_COPY[user?.role] || { title: "My queue", forward: "Forward", return: "Return" };
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
      <SectionHeader
        title={copy.title}
        right={
          <IconButton
            icon="document-text-outline"
            label="Records"
            onPress={() => navigation.navigate("RecordsTab")}
          />
        }
      />
      {stage ? (
        <View style={styles.bannerWrap}>
          <Card variant="muted" style={styles.banner}>
          <Text style={styles.bannerText}>
            Your queue shows records at stage {stage} — {stageLabel}.
          </Text>
          <Text style={styles.bannerSub}>This screen refreshes every 20 seconds while you stay here.</Text>
          </Card>
        </View>
      ) : (
        <View style={styles.bannerWrap}>
          <Card variant="muted" style={styles.banner}>
            <Text style={styles.bannerText}>No pipeline stage assigned to your account.</Text>
            <Text style={styles.bannerSub}>Ask GM to link you to a department.</Text>
          </Card>
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
                {item.needs_workflow_correction && item.pending_return_feedback ? (
                  <View style={styles.notice}>
                    <Text style={styles.noticeTitle}>Fix requested</Text>
                    <Text style={styles.noticeText} numberOfLines={3}>
                      {String(item.pending_return_feedback)}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.rowSub} numberOfLines={2}>
                  {(item.vendor_name || "—") +
                    ` · Stage ${item.current_stage}` +
                    (item.current_department_name ? ` · ${item.current_department_name}` : "")}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={2}>
                  {formatQty(item.quantity, item.unit)} / Entry {formatDate(item.entry_date)}
                  {slaTotalDays(item.entry_date, item.due_date) != null
                    ? ` / SLA ${slaTotalDays(item.entry_date, item.due_date)}d`
                    : ""}
                </Text>
                <View style={styles.badges}>
                  <Text style={[styles.badge, styles.badgeNeutral]}>
                    {(item.computed_alert_level || item.alert_level || "green").toString().toUpperCase()}
                  </Text>
                  <Text style={[styles.badge, styles.badgeNeutral]}>
                    Due {formatDate(item.due_date)}
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
                      <Text style={styles.quickPrimaryText}>{copy.forward}</Text>
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
                      <Text style={styles.quickPrimaryText}>{copy.return}</Text>
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
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  bannerWrap: { paddingHorizontal: theme.space.md, paddingTop: 2, paddingBottom: theme.space.sm },
  banner: { padding: theme.space.md },
  bannerText: { color: theme.colors.textBright, fontWeight: "900", fontSize: 13 },
  bannerSub: { color: theme.colors.text, fontWeight: "700", fontSize: 12, marginTop: 4 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listPad: { paddingVertical: 8 },
  emptyWrap: { flexGrow: 1, justifyContent: "center", padding: 24 },
  row: {
    backgroundColor: theme.colors.surfaceStrong,
    marginHorizontal: 12,
    marginVertical: 5,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: theme.colors.textBright,
  },
  rowSub: { marginTop: 4, fontSize: 13, color: theme.colors.text, lineHeight: 18 },
  rowMeta: { marginTop: 6, fontSize: 12, color: theme.colors.text, lineHeight: 17, fontWeight: "700" },
  notice: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(201, 162, 39, 0.45)",
    backgroundColor: "rgba(255, 232, 160, 0.35)",
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  noticeTitle: { fontSize: 12, fontWeight: "900", color: "#92400e" },
  noticeText: { fontSize: 12, color: "#92400e", fontWeight: "700", lineHeight: 16 },
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
