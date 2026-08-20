import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../AuthContext.jsx";
import { theme } from "../theme.js";
import { useResponsive } from "../utils/responsive.js";
import { useResponsiveType } from "../utils/typography.js";
import {
  clientIcon,
  clientLabel,
  formatRelativeTime,
  formatTs,
} from "../utils/sessionFormat.js";
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
} from "../components/ui/index.js";
import { showConfirm, showError, showSuccess } from "../utils/feedback.js";

function SessionCard({ session, type, revoking, disabled, onRevoke }) {
  const isCurrent = Boolean(session.is_current);
  const icon = clientIcon(session.client_kind);

  return (
    <View style={[styles.card, isCurrent && styles.cardCurrent]}>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, isCurrent && styles.iconWrapCurrent]}>
          <Ionicons
            name={icon}
            size={20}
            color={isCurrent ? theme.colors.accentHover : theme.colors.text}
          />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, type.h3]} numberOfLines={2}>
              {session.device_label || "Unknown device"}
            </Text>
            {isCurrent ? <Badge variant="accent">This device</Badge> : null}
          </View>
          {session.platform ? (
            <Text style={[styles.meta, type.body]} numberOfLines={2}>
              {session.platform}
            </Text>
          ) : null}
          <Text style={[styles.meta, type.caption]}>
            {clientLabel(session.client_kind)}
            {session.app_version ? ` · v${session.app_version}` : ""}
          </Text>
          <Text style={[styles.meta, type.caption]}>
            IP {session.ip_address || "—"}
          </Text>
        </View>
      </View>

      <View style={styles.times}>
        <View style={styles.timeRow}>
          <Ionicons name="log-in-outline" size={14} color={theme.colors.textMuted} />
          <Text style={[styles.timeText, type.caption]}>
            Signed in {formatTs(session.created_at)}
          </Text>
        </View>
        <View style={styles.timeRow}>
          <Ionicons name="pulse-outline" size={14} color={theme.colors.textMuted} />
          <Text style={[styles.timeText, type.caption]}>
            Active {formatRelativeTime(session.last_seen_at)}
          </Text>
        </View>
      </View>

      {!isCurrent && onRevoke ? (
        <Pressable
          onPress={() => onRevoke(session)}
          disabled={revoking || disabled}
          style={({ pressed }) => [
            styles.revokeBtn,
            pressed && !revoking && !disabled ? styles.revokePressed : null,
            revoking || disabled ? styles.revokeDisabled : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Sign out ${session.device_label || "device"}`}
        >
          {revoking ? (
            <ActivityIndicator size="small" color="#b91c1c" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={16} color="#b91c1c" />
              <Text style={styles.revokeText}>Sign out device</Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export function SessionsScreen() {
  const navigation = useNavigation();
  const { api } = useAuth();
  const { contentMaxWidth, horizontalPad } = useResponsive();
  const type = useResponsiveType();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState(null);
  const [bulkRevoking, setBulkRevoking] = useState(false);

  const otherSessions = useMemo(
    () => rows.filter((s) => !s.is_current),
    [rows],
  );

  const load = useCallback(
    async (mode = "load") => {
      if (!api) return;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await api.auth.listSessions({ active: true });
        if (res.ok) {
          const list = Array.isArray(res.data?.results) ? res.data.results : [];
          setRows(list);
        } else {
          setRows([]);
          setError(res.error || "Could not load sessions");
        }
      } catch (e) {
        setRows([]);
        setError(e?.message || "Could not load sessions");
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

  async function handleRevoke(session) {
    if (!api || session.is_current) return;
    showConfirm({
      title: "Sign out device",
      message: `End the session on “${session.device_label || "this device"}”? That device will need to sign in again.`,
      confirmText: "Sign out",
      cancelText: "Cancel",
      destructive: true,
      icon: "log-out-outline",
      onConfirm: async () => {
        setRevokingId(session.id);
        try {
          const res = await api.auth.revokeSession(session.id);
          if (!res.ok) {
            showError(res.error || "Could not end session");
            return;
          }
          showSuccess("Device signed out.");
          await load("refresh");
        } finally {
          setRevokingId(null);
        }
      },
    });
  }

  async function handleRevokeOthers() {
    if (!api || !otherSessions.length) return;
    showConfirm({
      title: "Sign out other devices",
      message: `End ${otherSessions.length} other active session${otherSessions.length === 1 ? "" : "s"}? Only this device will stay signed in.`,
      confirmText: "Sign out all",
      cancelText: "Cancel",
      destructive: true,
      icon: "shield-outline",
      onConfirm: async () => {
        setBulkRevoking(true);
        try {
          const res = await api.auth.revokeAllOtherSessions();
          if (res.data?.failed) {
            showError(`Signed out ${res.data.revoked || 0} device(s); ${res.data.failed} could not be ended.`);
          } else if (!res.ok) {
            showError(res.error || "Could not sign out other devices");
            return;
          } else {
            showSuccess(
              res.data?.revoked
                ? `Signed out ${res.data.revoked} other device${res.data.revoked === 1 ? "" : "s"}.`
                : "No other devices were signed in.",
            );
          }
          await load("refresh");
        } finally {
          setBulkRevoking(false);
        }
      },
    });
  }

  const listHeader = (
    <View style={styles.headerBlock}>
      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.backBtn, pressed && styles.backPressed]}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
      >
        <Ionicons name="chevron-back" size={22} color={theme.colors.accentHover} />
        <Text style={styles.backText}>Settings</Text>
      </Pressable>
      <PageHeader
        title="Devices"
        subtitle="Where your account is currently signed in"
      />
      <ErrorBanner message={error} onRetry={() => void load("refresh")} />
      {otherSessions.length > 0 ? (
        <Button
          title={bulkRevoking ? "Signing out…" : `Sign out ${otherSessions.length} other device${otherSessions.length === 1 ? "" : "s"}`}
          onPress={() => void handleRevokeOthers()}
          loading={bulkRevoking}
          disabled={bulkRevoking || Boolean(revokingId)}
          variant="secondary"
          style={styles.bulkBtn}
        />
      ) : null}
      {rows.length > 0 ? (
        <Text style={[styles.countHint, type.caption]}>
          {rows.length} active session{rows.length === 1 ? "" : "s"}
        </Text>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {loading && !rows.length ? (
        <LoadingBlock message="Loading devices…" fullScreen />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void load("refresh")}
              tintColor={theme.colors.accent}
            />
          }
          contentContainerStyle={[
            styles.list,
            {
              maxWidth: contentMaxWidth,
              alignSelf: "center",
              width: "100%",
              paddingHorizontal: horizontalPad,
            },
            !rows.length && styles.listEmpty,
          ]}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            !loading ? (
              <EmptyState
                icon="phone-portrait-outline"
                title="No active sessions"
                message="When you sign in on other phones or desktops, they will appear here."
                actionLabel="Refresh"
                onAction={() => void load("refresh")}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <SessionCard
              session={item}
              type={type}
              revoking={revokingId === item.id}
              disabled={bulkRevoking || Boolean(revokingId)}
              onRevoke={handleRevoke}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  headerBlock: { gap: theme.space.sm, paddingBottom: theme.space.sm },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: theme.space.xxs,
    paddingVertical: 4,
    paddingRight: 8,
  },
  backPressed: { opacity: 0.75 },
  backText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.accentHover,
    marginLeft: -2,
  },
  list: { paddingVertical: theme.space.md, gap: theme.space.sm },
  listEmpty: { flexGrow: 1 },
  countHint: { color: theme.colors.textMuted, marginTop: theme.space.xxs },
  bulkBtn: { marginTop: theme.space.xs },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.space.md,
    backgroundColor: theme.colors.surface,
    ...theme.shadow.sm,
  },
  cardCurrent: {
    borderColor: "rgba(15, 118, 110, 0.28)",
    backgroundColor: theme.colors.tintSoft,
  },
  cardTop: { flexDirection: "row", gap: theme.space.sm },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconWrapCurrent: {
    backgroundColor: theme.colors.accentMuted,
    borderColor: "rgba(15, 118, 110, 0.22)",
  },
  cardBody: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.space.sm,
  },
  title: { flex: 1, color: theme.colors.textBright },
  meta: { marginTop: 3, color: theme.colors.text },
  times: {
    marginTop: theme.space.sm,
    paddingTop: theme.space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.divider,
    gap: 6,
  },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeText: { color: theme.colors.textMuted },
  revokeBtn: {
    marginTop: theme.space.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.28)",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
  },
  revokePressed: { opacity: 0.88 },
  revokeDisabled: { opacity: 0.65 },
  revokeText: { fontSize: 14, fontWeight: "700", color: "#b91c1c" },
});
