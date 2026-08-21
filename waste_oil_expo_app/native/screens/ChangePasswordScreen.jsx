import React, { useMemo, useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";
import { theme } from "../theme.js";
import { Button } from "../components/ui/Button.jsx";
import { KeyboardAwareScroll } from "../components/ui/KeyboardAwareScroll.jsx";
import { showSuccess, showError, showBlockingError } from "../utils/feedback.js";
import { useScrollContentStyle } from "../utils/responsive.js";
import { useResponsiveType } from "../utils/typography.js";

export function ChangePasswordScreen({ navigation }) {
  const { api, user, refreshUser, logout } = useAuth();
  const scrollStyle = useScrollContentStyle();
  const type = useResponsiveType();
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
      showBlockingError("API not set", "Open Settings and set the API base URL first.");
      return;
    }
    if (!current) {
      showError("Enter your current password.");
      return;
    }
    if (next.length < 8) {
      showError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      showError("New password and confirmation do not match.");
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
      showSuccess("Password updated successfully.");
      navigation.replace("Home");
    } catch (e) {
      showError(e?.message || "Could not update password");
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
      <KeyboardAwareScroll contentContainerStyle={scrollStyle}>
          <Text style={[styles.title, type.title]}>{mustChange ? "Set a new password" : "Change password"}</Text>
          <Text style={[styles.help, type.body]}>
            {mustChange
              ? "For security, you must change your password before using the rest of the app."
              : "Update your password anytime."}
          </Text>

          <View style={styles.card}>
            <Text style={[styles.label, type.label]}>Current password</Text>
            <TextInput
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={mustChange ? "From your welcome email" : "Current password"}
              placeholderTextColor="#94a3b8"
              style={[styles.input, type.input, type.inputPad]}
            />

            <Text style={[styles.label, type.label]}>New password</Text>
            <TextInput
              value={next}
              onChangeText={setNext}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="At least 8 characters"
              placeholderTextColor="#94a3b8"
              style={[styles.input, type.input, type.inputPad]}
            />

            <Text style={[styles.label, type.label]}>Confirm new password</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Repeat new password"
              placeholderTextColor="#94a3b8"
              style={[styles.input, type.input, type.inputPad]}
            />

            <Button
              title="Update password"
              onPress={() => void onSubmit()}
              loading={busy}
              disabled={!canSubmit || busy}
            />

            {mustChange ? (
              <>
                <TouchableOpacity
                  style={styles.btnGhost}
                  onPress={() => navigation.navigate("Settings")}
                >
                  <Text style={styles.btnGhostText}>API Settings</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGhost} onPress={() => void onSignOut()}>
                  <Text style={styles.btnGhostText}>Sign out</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.btnGhost} onPress={() => navigation.goBack()}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnGhost} onPress={() => void onSignOut()}>
                  <Text style={styles.btnGhostText}>Sign out</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <Text style={[styles.foot, type.caption]}>
            {user?.username ? `Signed in as ${user.username}` : ""}{" "}
            {mustChange ? "Required step for new accounts." : "Use a strong password you do not reuse elsewhere."}
          </Text>
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  scroll: { padding: 16, paddingBottom: 28, gap: 10 },
  title: { fontSize: 20, fontWeight: "900", color: theme.colors.textBright },
  help: { fontSize: 14, color: theme.colors.text, lineHeight: 21 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 8,
  },
  label: { marginTop: 8, fontSize: 13, fontWeight: "800", color: theme.colors.textBright },
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
    marginTop: 14,
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.65 },
  btnText: { color: theme.colors.textInverse, fontWeight: "900", fontSize: 16 },
  btnGhost: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  btnGhostText: { color: theme.colors.text, fontWeight: "800", fontSize: 15 },
  foot: { marginTop: 8, fontSize: 12, color: theme.colors.textMuted, lineHeight: 18 },
});

