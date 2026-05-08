import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
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
      <Ionicons name={icon} size={18} color={danger ? "#b91c1c" : "#0f172a"} />
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Backend (LAN)</Text>
        <Text style={styles.help}>
          Use your PC/server IP plus the API path — same as{" "}
          <Text style={{ fontFamily: "monospace" }}>VITE_API_BASE_URL</Text> for the web app. Example:
        </Text>
        <Text style={styles.mono}>http://192.168.1.50:8000/api/v1</Text>
        <Text style={styles.help}>
          Android emulator to host machine Django:{" "}
          <Text style={{ fontWeight: "600" }}>{suggestLanPlaceholder()}</Text>
        </Text>
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
          <Text style={styles.btnText}>{saving ? "Saving…" : "Save & apply"}</Text>
        </TouchableOpacity>

        {user ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Account</Text>
            <Text style={styles.help}>Signed in as {user.full_name || user.username}</Text>

            <ActionRow
              icon="key-outline"
              label="Change password"
              onPress={() => navigation.navigate("ChangePassword")}
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
          </>
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
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.colors.textBright,
  },
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
  divider: { height: 1, backgroundColor: theme.colors.border, marginTop: 18, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.textBright, marginBottom: 4 },
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
  actionText: { color: theme.colors.textBright, fontWeight: "900", fontSize: 15 },
});
