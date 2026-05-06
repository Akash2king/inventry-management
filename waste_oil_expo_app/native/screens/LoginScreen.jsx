import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";

export function LoginScreen({ navigation }) {
  const { login, api, apiBase } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    if (!api) {
      Alert.alert(
        "Set API URL first",
        "Open Settings and enter your Django API base (LAN), e.g. http://192.168.1.5:8000/api/v1",
      );
      return;
    }
    setBusy(true);
    try {
      await login(username.trim(), password);
      navigation.reset({ index: 0, routes: [{ name: "Records" }] });
    } catch (e) {
      Alert.alert("Login failed", e?.message || "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.card}>
          <Text style={styles.brand}>Chem-Solv Inventory</Text>
          <Text style={styles.sub}>Native • same network as backend</Text>
          {!apiBase ? (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>Set backend URL before signing in.</Text>
              <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
                <Text style={styles.bannerLink}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.endpoint} numberOfLines={2}>
              {apiBase}
            </Text>
          )}
          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={Boolean(api)}
            style={styles.input}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={Boolean(api)}
            style={styles.input}
          />
          <TouchableOpacity
            style={[styles.primary, (!api || busy) && styles.disabled]}
            onPress={() => void handleLogin()}
            disabled={!api || busy}
          >
            <Text style={styles.primaryText}>{busy ? "Signing in…" : "Sign in"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => navigation.navigate("Settings")}
          >
            <Text style={styles.secondaryText}>API Settings</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#e2e8f0",
  },
  flex: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  brand: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  sub: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 14,
    marginBottom: 16,
  },
  banner: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: {
    color: "#92400e",
    fontSize: 14,
  },
  bannerLink: {
    marginTop: 8,
    color: "#b45309",
    fontWeight: "700",
  },
  endpoint: {
    fontSize: 11,
    color: "#0369a1",
    marginBottom: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    marginBottom: 14,
    color: "#0f172a",
  },
  primary: {
    backgroundColor: "#15803d",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondary: {
    marginTop: 14,
    alignItems: "center",
    padding: 10,
  },
  secondaryText: {
    color: "#15803d",
    fontWeight: "700",
    fontSize: 15,
  },
});
