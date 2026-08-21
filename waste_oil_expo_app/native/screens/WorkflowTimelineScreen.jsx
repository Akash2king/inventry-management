import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";
import { theme } from "../theme.js";
import { EmptyState, ErrorBanner, FadeIn, LoadingBlock } from "../components/ui/index.js";
import { useResponsive } from "../utils/responsive.js";

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
  const { contentMaxWidth, horizontalPad } = useResponsive();
  const recordId = route.params?.recordId ? String(route.params.recordId) : "";
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!api || !recordId) return;
    try {
      const tr = await api.workflow.getTransitions(recordId);
      if (tr.ok && Array.isArray(tr.data)) {
        setRows(tr.data.slice(0).reverse());
        setLoadError("");
      } else {
        setRows([]);
        setLoadError(tr.error || "Could not load workflow history.");
      }
    } catch (e) {
      setRows([]);
      setLoadError(e?.message || "Could not load workflow history.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <LoadingBlock message="Loading timeline…" fullScreen />
      </SafeAreaView>
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
            tintColor={theme.colors.accent}
          />
        }
        renderItem={({ item, index }) => (
          <FadeIn delay={Math.min(index * 48, 240)} style={styles.cardWrap}>
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
          </FadeIn>
        )}
        ListHeaderComponent={
          <ErrorBanner
            message={loadError}
            onRetry={() => {
              setLoading(true);
              void load();
            }}
          />
        }
        ListEmptyComponent={
          loadError ? null : (
            <EmptyState
              icon="git-branch-outline"
              title="No workflow history"
              message="Transitions will appear here after the record moves through the pipeline."
            />
          )
        }
        contentContainerStyle={[
          rows.length === 0 ? styles.emptyWrap : styles.listPad,
          { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%", paddingHorizontal: horizontalPad },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  listPad: { paddingVertical: theme.space.lg, gap: theme.space.sm },
  emptyWrap: { flexGrow: 1, justifyContent: "center" },
  cardWrap: {},
  card: {
    backgroundColor: theme.colors.surfaceStrong,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.space.lg,
    ...theme.shadow.sm,
  },
  title: { fontSize: 15, fontWeight: "800", color: theme.colors.textBright },
  meta: { marginTop: 6, fontSize: 12, fontWeight: "600", color: theme.colors.textMuted },
  note: { marginTop: 8, fontSize: 13, color: theme.colors.text },
  dept: { marginTop: 8, fontSize: 12, color: theme.colors.textMuted },
});
