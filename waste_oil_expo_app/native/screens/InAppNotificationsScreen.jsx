import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";
import {
  getWorkflowNotificationPermissionStatus,
  isExpoPushRuntimeSupported,
  requestWorkflowNotificationPermissions,
  setAppBadgeCountSafe,
} from "../systemNotifications.js";
import { theme } from "../theme.js";

function formatTs(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function InAppNotificationsScreen({ navigation }) {
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [pushPerm, setPushPerm] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    void (async () => {
      const s = await getWorkflowNotificationPermissionStatus();
      setPushPerm(s);
    })();
  }, []);

  const load = useCallback(
    async (mode = "load") => {
      if (!api) return;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      try {
        const [listRes, countRes] = await Promise.all([
          api.notifications.list({ unread: onlyUnread }),
          api.notifications.unreadCount(),
        ]);
        if (listRes.ok) {
          const list = Array.isArray(listRes.data?.results) ? listRes.data.results : [];
          setRows(list);
        } else {
          setRows([]);
        }
        const c =
          countRes.ok && countRes.data
            ? Number(countRes.data.unread_count ?? 0)
            : 0;
        setUnreadTotal(c);
        await setAppBadgeCountSafe(c);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, onlyUnread],
  );

  useEffect(() => {
    void load("load");
  }, [load]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle:
        unreadTotal > 0
          ? `Workflow notifications (${unreadTotal})`
          : "Workflow notifications",
    });
  }, [navigation, unreadTotal]);

  async function markRead(id) {
    if (!api) return;
    await api.notifications.markRead(id);
    await load("refresh");
  }

  async function markAll() {
    if (!api || unreadTotal <= 0) return;
    await api.notifications.markAllRead();
    await load("refresh");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.chip, onlyUnread && styles.chipOn]}
          onPress={() => setOnlyUnread((v) => !v)}
        >
          <Text style={styles.chipText}>{onlyUnread ? "Unread only" : "All"}</Text>
        </TouchableOpacity>
        {unreadTotal > 0 ? (
          <View style={styles.unreadBadge} accessibilityLabel={`${unreadTotal} unread`}>
            <Text style={styles.unreadBadgeText}>{unreadTotal}</Text>
          </View>
        ) : null}
        {unreadTotal > 0 ? (
          <TouchableOpacity style={styles.chipGhost} onPress={() => void markAll()}>
            <Text style={styles.chipGhostText}>Mark all read ({unreadTotal})</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.chipGhost} onPress={() => navigation.navigate("Sessions")}>
          <Text style={styles.chipGhostText}>Devices</Text>
        </TouchableOpacity>
      </View>
      {loading && !rows.length ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load("refresh")} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            Platform.OS === "web" ? null : !isExpoPushRuntimeSupported() ? (
              <View style={styles.pushBanner}>
                <Text style={styles.pushTitle}>System notifications</Text>
                <Text style={styles.pushBody}>
                  Expo Go no longer includes the native notification module on Android (SDK 53+). Use a{" "}
                  <Text style={{ fontWeight: "700" }}>development build</Text> ({`expo run:android`} / EAS) for tray
                  notifications. In-app list still works here.
                </Text>
              </View>
            ) : (
              <View style={styles.pushBanner}>
                <Text style={styles.pushTitle}>System notifications</Text>
                <Text style={styles.pushBody}>
                  Allow alerts so new workflow updates (records, SLA, etc.) appear in the system notification tray when
                  the app is in the background.
                </Text>
                {pushPerm === "granted" ? (
                  <Text style={styles.pushOk}>Enabled</Text>
                ) : pushPerm === "denied" ? (
                  <Text style={styles.pushDenied}>Turn on in OS Settings → Notifications for this app.</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.pushBtn}
                    onPress={async () => {
                      const r = await requestWorkflowNotificationPermissions();
                      setPushPerm(r.status);
                    }}
                  >
                    <Text style={styles.pushBtnText}>Enable push alerts</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
          ListEmptyComponent={<Text style={styles.empty}>No notifications.</Text>}
          renderItem={({ item: n }) => (
            <View style={[styles.card, !n.read_at && styles.cardUnread]}>
              <Text style={styles.title}>{n.title}</Text>
              {n.body ? <Text style={styles.body}>{n.body}</Text> : null}
              <Text style={styles.meta}>{formatTs(n.created_at)}</Text>
              {!n.read_at ? (
                <TouchableOpacity style={styles.btn} onPress={() => void markRead(n.id)}>
                  <Text style={styles.btnText}>Acknowledge</Text>
                </TouchableOpacity>
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
  toolbar: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.colors.surface,
  },
  chipOn: { borderColor: theme.colors.accent, backgroundColor: "rgba(59, 130, 246, 0.08)" },
  chipText: { fontSize: 13, fontWeight: "600", color: theme.colors.textBright },
  chipGhost: { paddingHorizontal: 10, paddingVertical: 8 },
  chipGhostText: { fontSize: 13, color: theme.colors.accent, fontWeight: "600" },
  unreadBadge: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "rgba(239, 68, 68, 0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  list: { padding: 16, gap: 12 },
  empty: { textAlign: "center", opacity: 0.7, marginTop: 24 },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: theme.colors.surface,
  },
  cardUnread: { backgroundColor: "rgba(59, 130, 246, 0.06)" },
  title: { fontSize: 16, fontWeight: "700", color: theme.colors.textBright },
  body: { marginTop: 6, fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  meta: { marginTop: 6, fontSize: 12, opacity: 0.65 },
  btn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  pushBanner: {
    marginBottom: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: "rgba(59, 130, 246, 0.06)",
  },
  pushTitle: { fontSize: 15, fontWeight: "700", color: theme.colors.textBright },
  pushBody: { marginTop: 6, fontSize: 13, color: theme.colors.text, lineHeight: 19 },
  pushOk: { marginTop: 10, fontSize: 13, fontWeight: "600", color: "#15803d" },
  pushDenied: { marginTop: 10, fontSize: 13, color: "#b45309" },
  pushBtn: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pushBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
