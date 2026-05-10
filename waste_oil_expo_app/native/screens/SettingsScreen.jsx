import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { saveApiBase, suggestLanPlaceholder } from "../apiConfig.js";
import { useAuth } from "../AuthContext.jsx";
import { theme } from "../theme.js";

function ActionRow({ icon, label, onPress, danger }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, danger && { borderColor: "rgba(239,68,68,0.35)" }]}
      onPress={onPress}
    >
      <View style={[styles.actionIconWrap, danger && styles.actionIconWrapDanger]}>
        <Ionicons name={icon} size={18} color={danger ? "#b91c1c" : theme.colors.accentHover} />
      </View>
      <Text style={[styles.actionText, danger && { color: "#b91c1c" }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Ionicons name="chevron-forward" size={18} color={danger ? "rgba(185,28,28,0.6)" : "rgba(15,23,42,0.4)"} />
    </TouchableOpacity>
  );
}

export function SettingsScreen({ navigation }) {
  const { apiBase, applyApiBase, user, logout } = useAuth();
  const [url, setUrl] = useState(apiBase || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const trimmed = await saveApiBase(url);
      await applyApiBase(trimmed);
      Alert.alert("Saved", "API base URL updated. Login again if your session expired.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Could not save", e?.message || "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.bg} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="settings-outline" size={24} color={theme.colors.accentHover} />
          </View>
          <Text style={styles.kicker}>Settings</Text>
          <Text style={styles.title}>Personalize the app</Text>
          <Text style={styles.subtitle}>
            Update the connection used by this device and access your account tools from one simple screen.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Connection</Text>
              <Text style={styles.sectionHint}>Keep this pointed at your office/backend server.</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>LAN</Text>
            </View>
          </View>

          <Text style={styles.help}>
            If the app is used on the same network, this should match your backend IP address.
          </Text>
          <Text style={styles.mono}>{suggestLanPlaceholder()}</Text>
          <Text style={styles.label}>API base URL</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={`e.g. ${suggestLanPlaceholder()}`}
            placeholderTextColor="#94a3b8"
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.btn, saving && styles.btnDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            <Text style={styles.btnText}>{saving ? "Saving…" : "Save connection"}</Text>
          </TouchableOpacity>
        </View>

        {user ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Account</Text>
                <Text style={styles.sectionHint}>Signed in user and app shortcuts.</Text>
              </View>
              <View style={styles.accountBadge}>
                <Text style={styles.accountBadgeText}>{(user.full_name || user.username || "U").slice(0, 2).toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.accountCard}>
              <Text style={styles.accountName}>{user.full_name || user.username}</Text>
              <Text style={styles.accountMeta}>{user.role || "User"}</Text>
            </View>

            <ActionRow
              icon="key-outline"
              label="Change password"
              onPress={() => navigation.navigate("ChangePassword")}
            />

            <ActionRow
              icon="phone-portrait-outline"
              label="Devices"
              onPress={() => navigation.navigate("Sessions")}
            />
            <ActionRow
              icon="notifications-outline"
              label="Workflow notifications"
              onPress={() => navigation.navigate("InAppNotifications")}
            />

            {user.role === "manager" || user.role === "gm" || user.role === "superadmin" ? (
              <ActionRow
                icon="shield-checkmark-outline"
                label="Audit logs"
                onPress={() => navigation.navigate("AuditLogs")}
              />
            ) : null}

            {user.role === "gm" || user.role === "superadmin" ? (
              <ActionRow
                icon="construct-outline"
                label="GM console"
                onPress={() => navigation.navigate("GmConsole")}
              />
            ) : null}

            <ActionRow
              icon="log-out-outline"
              label="Sign out"
              danger
              onPress={() => {
                Alert.alert("Sign out", "Do you want to sign out?", [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Sign out",
                    style: "destructive",
                    onPress: async () => {
                      await logout().catch(() => {});
                      navigation.getParent()?.reset({ index: 0, routes: [{ name: "Login" }] });
                    },
                  },
                ]);
              }}
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
    gap: 14,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 16,
    backgroundColor: theme.colors.surface,
    gap: 8,
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.10)",
  },
  kicker: {
    fontSize: 12,
    fontWeight: "800",
    color: theme.colors.accentHover,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.textBright,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 21,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 18,
    padding: 16,
    backgroundColor: theme.colors.surface,
    gap: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHint: { fontSize: 13, color: theme.colors.text, marginTop: 2 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(59, 130, 246, 0.10)",
  },
  pillText: { fontSize: 11, fontWeight: "800", color: theme.colors.accentHover, letterSpacing: 0.4 },
  help: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 21,
  },
  mono: {
    fontFamily: "monospace",
    fontSize: 13,
    color: theme.colors.accentHover,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    borderRadius: 8,
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: theme.colors.textBright,
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    color: theme.colors.textBright,
    backgroundColor: theme.colors.surface,
  },
  btn: {
    marginTop: 18,
    backgroundColor: theme.colors.accentHover,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.textBright },
  accountBadge: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  accountBadgeText: { fontSize: 13, fontWeight: "800", color: theme.colors.accentHover },
  accountCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(15, 23, 42, 0.03)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  accountName: { fontSize: 15, fontWeight: "800", color: theme.colors.textBright },
  accountMeta: { marginTop: 4, fontSize: 13, color: theme.colors.text, textTransform: "capitalize" },
  actionRow: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  actionIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(59, 130, 246, 0.08)",
  },
  actionIconWrapDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  actionText: { color: theme.colors.textBright, fontWeight: "900", fontSize: 15 },
});
