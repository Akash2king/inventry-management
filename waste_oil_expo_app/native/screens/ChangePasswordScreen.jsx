import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";

export function ChangePasswordScreen({ navigation }) {
  const { api, user, refreshUser, logout } = useAuth();
  const mustChange = Boolean(user?.must_change_password);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const canSubmit = useMemo(() => {
    if (!api) return false;
    if (!current) return false;
    if (!next || next.length < 8) return false;
    if (next !== confirm) return false;
    return true;
  }, [api, current, next, confirm]);

  async function onSubmit() {
    if (!api) {
      Alert.alert("API not set", "Open Settings and set the API base URL first.");
      return;
    }
    if (!current) {
      Alert.alert("Missing", "Enter your current password.");
      return;
    }
    if (next.length < 8) {
      Alert.alert("Too short", "New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      Alert.alert("Mismatch", "New password and confirmation do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await api.auth.changePassword({
        old_password: current,
        new_password: next,
      });
      if (!res.ok) {
        throw new Error(res.error || "Could not update password");
      }
      await refreshUser();
      Alert.alert("Updated", "Password updated successfully.");
      navigation.replace("Home");
    } catch (e) {
      Alert.alert("Failed", e?.message || "Could not update password");
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    await logout().catch(() => {});
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{mustChange ? "Set a new password" : "Change password"}</Text>
          <Text style={styles.help}>
            {mustChange
              ? "For security, you must change your password before using the rest of the app."
              : "Update your password anytime."}
          </Text>

          <View style={styles.card}>
            <Text style={styles.label}>Current password</Text>
            <TextInput
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={mustChange ? "From your welcome email" : "Current password"}
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />

            <Text style={styles.label}>New password</Text>
            <TextInput
              value={next}
              onChangeText={setNext}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="At least 8 characters"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Repeat new password"
              placeholderTextColor="#94a3b8"
              style={styles.input}
            />

            <TouchableOpacity
              style={[styles.btn, (!canSubmit || busy) && styles.btnDisabled]}
              disabled={!canSubmit || busy}
              onPress={() => void onSubmit()}
            >
              <Text style={styles.btnText}>{busy ? "Updating…" : "Update password"}</Text>
            </TouchableOpacity>

            {!mustChange ? (
              <TouchableOpacity style={styles.btnGhost} onPress={() => navigation.goBack()}>
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.btnGhost} onPress={() => void onSignOut()}>
              <Text style={styles.btnGhostText}>Sign out</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.foot}>
            {user?.username ? `Signed in as ${user.username}` : ""}{" "}
            {mustChange ? "Required step for new accounts." : "Use a strong password you do not reuse elsewhere."}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  scroll: { padding: 16, paddingBottom: 28, gap: 10 },
  title: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  help: { fontSize: 14, color: "#475569", lineHeight: 21 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 8,
  },
  label: { marginTop: 8, fontSize: 13, fontWeight: "800", color: "#334155" },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    color: "#0f172a",
    backgroundColor: "#fff",
  },
  btn: {
    marginTop: 14,
    backgroundColor: "#15803d",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  btnGhost: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.35)",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  btnGhostText: { color: "#475569", fontWeight: "800", fontSize: 15 },
  foot: { marginTop: 8, fontSize: 12, color: "#64748b", lineHeight: 18 },
});

