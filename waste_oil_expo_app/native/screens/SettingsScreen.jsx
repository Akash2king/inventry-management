import React, { useState } from "react";
import {
  Keyboard,
  Linking,
  Platform,
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
import {
  registerPushWithBackend,
  requestPushPermission,
} from "../oneSignalService.js";
import { theme } from "../theme.js";
import { Button, KeyboardAwareScroll, PageHeader } from "../components/ui/index.js";
import { showSuccess, showError, showAlert, showConfirm } from "../utils/feedback.js";
import { useScrollContentStyle } from "../utils/responsive.js";
import { useResponsiveType } from "../utils/typography.js";

function ActionRow({ icon, label, onPress, danger, type }) {
  return (
    <TouchableOpacity
      style={[styles.actionRow, danger && { borderColor: "rgba(239,68,68,0.35)" }]}
      onPress={onPress}
    >
      <View style={[styles.actionIconWrap, danger && styles.actionIconWrapDanger]}>
        <Ionicons name={icon} size={18} color={danger ? "#b91c1c" : theme.colors.accentHover} />
      </View>
      <Text style={[styles.actionText, type.h3, danger && { color: "#b91c1c" }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      <Ionicons name="chevron-forward" size={18} color={danger ? "rgba(185,28,28,0.6)" : "rgba(15,23,42,0.4)"} />
    </TouchableOpacity>
  );
}

export function SettingsScreen({ navigation }) {
  const { apiBase, applyApiBase, user, logout, api } = useAuth();
  const type = useResponsiveType();
  const scrollStyle = useScrollContentStyle({ gap: 14, paddingTop: 0 });
  const [url, setUrl] = useState(apiBase || "");
  const [saving, setSaving] = useState(false);
  const mustChange = Boolean(user?.must_change_password);

  async function handleSave() {
    setSaving(true);
    try {
      Keyboard.dismiss();
      const trimmed = await saveApiBase(url);
      await applyApiBase(trimmed);
      showSuccess("API base URL updated.");
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    } catch (e) {
      showError(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.bg} />
      <KeyboardAwareScroll contentContainerStyle={scrollStyle}>
        <PageHeader
          title="Settings"
          subtitle="Connection, account, and device tools"
        />

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, type.h2]}>Connection</Text>
              <Text style={[styles.sectionHint, type.body]}>Keep this pointed at your office/backend server.</Text>
            </View>
            <View style={styles.pill}>
              <Text style={[styles.pillText, type.micro]}>LAN</Text>
            </View>
          </View>

          <Text style={[styles.help, type.body]}>
            If the app is used on the same network, this should match your backend IP address.
          </Text>
          <Text style={[styles.mono, type.caption]}>{suggestLanPlaceholder()}</Text>
          <Text style={[styles.label, type.label]}>API base URL</Text>
          <TextInput
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={`e.g. ${suggestLanPlaceholder()}`}
            placeholderTextColor="#94a3b8"
            style={[styles.input, type.input, type.inputPad]}
          />
          <Button
            title="Save connection"
            onPress={() => void handleSave()}
            loading={saving}
            disabled={saving}
          />
        </View>

        {user ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={[styles.sectionTitle, type.h2]}>Account</Text>
                <Text style={[styles.sectionHint, type.body]}>Signed in user and app shortcuts.</Text>
              </View>
              <View style={styles.accountBadge}>
                <Text style={styles.accountBadgeText}>{(user.full_name || user.username || "U").slice(0, 2).toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.accountCard}>
              <Text style={[styles.accountName, type.h3]}>{user.full_name || user.username}</Text>
              <Text style={[styles.accountMeta, type.body]}>{user.role || "User"}</Text>
            </View>

            <ActionRow
              icon="key-outline"
              label="Change password"
              type={type}
              onPress={() => navigation.navigate("ChangePassword")}
            />

            <ActionRow
              icon="phone-portrait-outline"
              label="Devices & sessions"
              type={type}
              onPress={() => navigation.navigate("Sessions")}
            />
            <ActionRow
              icon="notifications-outline"
              label="Workflow notifications"
              type={type}
              onPress={() => navigation.navigate("InAppNotifications")}
            />

            <ActionRow
              icon="megaphone-outline"
              label="Re-request push permission"
              type={type}
              onPress={() => {
                void (async () => {
                  await requestPushPermission();
                  if (api) {
                    await registerPushWithBackend(api);
                  }
                  showAlert(
                    "Notifications",
                    "If the system denied access earlier, open system settings for this app and enable notifications.",
                    [
                      { text: "OK", style: "cancel" },
                      { text: "Open settings", style: "default", onPress: () => void Linking.openSettings() },
                    ],
                    { icon: "notifications-outline" },
                  );
                })();
              }}
            />

            {Platform.OS === "android" ? (
              <ActionRow
                icon="battery-charging-outline"
                label="Battery & background (Android)"
                type={type}
                onPress={() => {
                  showAlert(
                    "Reliable background delivery",
                    "Open App info → Battery (or Power) and set this app to Unrestricted. That helps background inbox checks and avoids delayed alerts on some devices.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { text: "Open app settings", style: "default", onPress: () => void Linking.openSettings() },
                    ],
                    { icon: "battery-charging-outline", variant: "warning" },
                  );
                }}
              />
            ) : null}

            {!mustChange && (user.role === "manager" || user.role === "gm" || user.role === "superadmin") ? (
              <ActionRow
                icon="shield-checkmark-outline"
                label="Audit logs"
                type={type}
                onPress={() => navigation.navigate("AuditLogs")}
              />
            ) : null}

            {!mustChange && (user.role === "gm" || user.role === "superadmin") ? (
              <ActionRow
                icon="construct-outline"
                label="GM console"
                type={type}
                onPress={() => navigation.navigate("GmConsole")}
              />
            ) : null}

            <ActionRow
              icon="log-out-outline"
              label="Sign out"
              type={type}
              danger
              onPress={() => {
                showConfirm({
                  title: "Sign out",
                  message: "Do you want to sign out of this device?",
                  confirmText: "Sign out",
                  cancelText: "Cancel",
                  destructive: true,
                  onConfirm: async () => {
                    await logout().catch(() => {});
                    navigation.getParent()?.reset({ index: 0, routes: [{ name: "Login" }] });
                  },
                });
              }}
            />
          </View>
        ) : null}
      </KeyboardAwareScroll>
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
    backgroundColor: theme.colors.accentMuted,
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
  sectionHint: { color: theme.colors.text, marginTop: 2 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.accentMuted,
  },
  pillText: { fontWeight: "800", color: theme.colors.accentHover, letterSpacing: 0.4 },
  help: {
    color: theme.colors.text,
  },
  mono: {
    fontFamily: "monospace",
    color: theme.colors.accentHover,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 10,
    borderRadius: 8,
  },
  label: {
    marginTop: 8,
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
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
  sectionTitle: { fontWeight: "800", color: theme.colors.textBright },
  accountBadge: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: theme.colors.accentMuted,
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
  accountName: { fontWeight: "800", color: theme.colors.textBright },
  accountMeta: { marginTop: 4, color: theme.colors.text, textTransform: "capitalize" },
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
    backgroundColor: theme.colors.accentSoft,
  },
  actionIconWrapDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  actionText: { color: theme.colors.textBright, fontWeight: "900" },
});
