import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../AuthContext.jsx";
import { STAGE_LABELS } from "../utils/stageLabels.js";
import { canActForward, canActReturn, stageForRole } from "../utils/permissions.js";
import { theme } from "../theme.js";
import { Card, IconButton, SectionHeader, ErrorBanner, EmptyState, LoadingBlock, QueueListCard } from "../components/ui/index.js";
import { FLATLIST_PERF } from "../utils/listPerf.js";
import { formatDate, formatQty, slaTotalDays } from "../utils/formatters.js";
import { useResponsive } from "../utils/responsive.js";
import { ContentWidth } from "../components/ui/ContentWidth.jsx";

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
  const { listColumns, horizontalPad, contentMaxWidth, gridGap } = useResponsive();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

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
      setLastUpdated(new Date());
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
      void tick();
      const id = setInterval(() => void tick(), 20000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, [load]),
  );

  const openDetail = useCallback(
    (item, autoOpen) => {
      navigation.getParent()?.navigate("RecordDetail", {
        recordId: String(item.id),
        title: item.record_number,
        autoOpen: autoOpen || "",
      });
    },
    [navigation],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <QueueListCard
        item={item}
        gridMode={listColumns > 1}
        user={user}
        copy={copy}
        onOpen={() => openDetail(item)}
        onForward={() => openDetail(item, "forward")}
        onReturn={() => openDetail(item, "return")}
        canActForward={canActForward}
        canActReturn={canActReturn}
        formatDate={formatDate}
        formatQty={formatQty}
        slaTotalDays={slaTotalDays}
      />
    ),
    [user, copy, openDetail, listColumns],
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <SectionHeader
        title={copy.title}
        subtitle={stage ? `Stage ${stage} · ${stageLabel}` : "Workflow queue"}
        right={
          <IconButton
            icon="document-text-outline"
            label="Records"
            onPress={() => navigation.navigate("RecordsTab")}
          />
        }
      />
      {stage ? (
        <ContentWidth>
        <View style={styles.bannerWrap}>
          <Card variant="muted" style={styles.banner}>
            <Text style={styles.bannerText}>
              Records at stage {stage} — {stageLabel}. Auto-refresh every 20s.
            </Text>
          </Card>
        </View>
        </ContentWidth>
      ) : (
        <ContentWidth>
        <View style={styles.bannerWrap}>
          <Card variant="muted" style={styles.banner}>
            <Text style={styles.bannerText}>No pipeline stage assigned. Ask GM to link your department.</Text>
          </Card>
        </View>
        </ContentWidth>
      )}
      {lastUpdated ? (
        <Text style={[styles.updated, { paddingHorizontal: horizontalPad }]}>
          Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      ) : null}
      <ErrorBanner message={error} onRetry={() => { setLoading(true); void load(); }} />
      {loading ? (
        <LoadingBlock message="Loading queue…" />
      ) : (
        <FlatList
          data={queue}
          key={`queue-${listColumns}`}
          numColumns={listColumns}
          columnWrapperStyle={listColumns > 1 ? { gap: gridGap, paddingHorizontal: horizontalPad } : undefined}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
              tintColor={theme.colors.accent}
            />
          }
          renderItem={renderItem}
          {...FLATLIST_PERF}
          ListEmptyComponent={
            error ? null : (
              <EmptyState
                icon="checkmark-done-outline"
                title="Queue is clear"
                message="Nothing needs your action. Pull to refresh."
              />
            )
          }
          contentContainerStyle={[
            queue.length === 0 ? styles.emptyWrap : styles.listPad,
            { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" },
          ]}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  updated: {
    paddingBottom: theme.space.xs,
    ...theme.type.micro,
  },
  bannerWrap: { paddingBottom: theme.space.xs },
  banner: { padding: theme.space.sm },
  bannerText: { ...theme.type.caption, color: theme.colors.textBright, fontWeight: "600" },
  listPad: { paddingVertical: theme.space.xs },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
});
