import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";
import {
  getPushPermissionStatus,
  isOneSignalRuntimeSupported,
  registerPushWithBackend,
  requestPushPermission,
  setAppBadgeCountSafe,
} from "../oneSignalService.js";
import { theme } from "../theme.js";
import { useResponsive } from "../utils/responsive.js";
import { useResponsiveType } from "../utils/typography.js";

function formatTs(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

export function InAppNotificationsScreen({ navigation }) {
  const { api, user } = useAuth();
  const { contentMaxWidth, horizontalPad } = useResponsive();
  const type = useResponsiveType();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [pushPerm, setPushPerm] = useState("");
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);
  const [testPushBusy, setTestPushBusy] = useState(false);
  const canBroadcast = user?.role === "manager" || user?.role === "gm" || user?.role === "superadmin";

  useEffect(() => {
    void (async () => {
      const s = await getPushPermissionStatus();
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

  async function sendTestPush() {
    if (!api || testPushBusy) return;
    setTestPushBusy(true);
    try {
      const res = await api.notifications.sendTestPush({
        title: "Chem-Solv test",
        body: "Workflow push delivery test from this device.",
      });
      if (!res.ok) {
        throw new Error(res.error || "Could not send test push");
      }
      await load("refresh");
    } finally {
      setTestPushBusy(false);
    }
  }

  async function sendBroadcast() {
    if (!api || !canBroadcast) return;
    const title = broadcastTitle.trim();
    const body = broadcastBody.trim();
    if (!title) return;
    setBroadcastBusy(true);
    try {
      const res = await api.notifications.broadcast({ title, body });
      if (!res.ok) {
        throw new Error(res.error || "Could not send notification");
      }
      setBroadcastTitle("");
      setBroadcastBody("");
      await load("refresh");
    } finally {
      setBroadcastBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
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

      {canBroadcast ? (
        <View style={styles.broadcastCard}>
          <Text style={styles.broadcastTitle}>Send announcement</Text>
          <Text style={styles.broadcastHelp}>
            Send a custom message to all active users. It will appear in their notification feed and on the app.
          </Text>
          <TextInput
            value={broadcastTitle}
            onChangeText={setBroadcastTitle}
            placeholder="Title"
            placeholderTextColor="#94a3b8"
            style={[styles.broadcastInput, type.input, type.inputPad]}
          />
          <TextInput
            value={broadcastBody}
            onChangeText={setBroadcastBody}
            placeholder="Message"
            placeholderTextColor="#94a3b8"
            style={[styles.broadcastInput, type.input, type.inputPad, styles.broadcastTextArea]}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.broadcastBtn, (!broadcastTitle.trim() || broadcastBusy) && styles.broadcastBtnDisabled]}
            onPress={() => void sendBroadcast()}
            disabled={!broadcastTitle.trim() || broadcastBusy}
          >
            <Text style={styles.broadcastBtnText}>{broadcastBusy ? "Sending…" : "Send to all users"}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
          ListHeaderComponent={
            Platform.OS === "web" ? null : !isOneSignalRuntimeSupported() ? (
              <View style={styles.pushBanner}>
                <Text style={styles.pushTitle}>System notifications</Text>
                <Text style={styles.pushBody}>
                  Push notifications require a native build ({`expo run:android`} / EAS). They are not available on web.
                </Text>
              </View>
            ) : (
              <View style={styles.pushBanner}>
                <Text style={styles.pushTitle}>System notifications</Text>
                <Text style={styles.pushBody}>
                  Allow alerts so workflow updates appear in the notification tray via OneSignal when the app is in the
                  background.
                </Text>
                {pushPerm === "granted" ? (
                  <>
                    <Text style={styles.pushOk}>Enabled</Text>
                    <TouchableOpacity
                      style={[styles.pushBtn, styles.pushBtnSecondary, testPushBusy && styles.broadcastBtnDisabled]}
                      onPress={() => void sendTestPush()}
                      disabled={testPushBusy}
                    >
                      <Text style={styles.pushBtnText}>{testPushBusy ? "Sending…" : "Send test push"}</Text>
                    </TouchableOpacity>
                  </>
                ) : pushPerm === "denied" ? (
                  <Text style={styles.pushDenied}>Turn on in OS Settings → Notifications for this app.</Text>
                ) : (
                  <TouchableOpacity
                    style={styles.pushBtn}
                    onPress={async () => {
                      const r = await requestPushPermission();
                      setPushPerm(r.status);
                      if (api && r.status === "granted") {
                        await registerPushWithBackend(api);
                      }
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
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
  list: { paddingVertical: 16, gap: 12 },
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
  pushBtnSecondary: {
    marginTop: 8,
    backgroundColor: "#334155",
  },
  pushBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  broadcastCard: {
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    backgroundColor: theme.colors.surface,
    gap: 10,
  },
  broadcastTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.textBright },
  broadcastHelp: { fontSize: 13, color: theme.colors.text, lineHeight: 18 },
  broadcastInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
    color: theme.colors.textBright,
    backgroundColor: theme.colors.bg,
  },
  broadcastTextArea: { minHeight: 92, textAlignVertical: "top" },
  broadcastBtn: {
    backgroundColor: theme.colors.accentHover,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  broadcastBtnDisabled: { opacity: 0.6 },
  broadcastBtnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
