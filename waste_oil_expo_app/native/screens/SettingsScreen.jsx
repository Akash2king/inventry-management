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
import { saveApiBase, suggestLanPlaceholder } from "../apiConfig.js";
import { useAuth } from "../AuthContext.jsx";

export function SettingsScreen({ navigation }) {
  const { apiBase, applyApiBase } = useAuth();
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f1f5f9",
  },
  scroll: {
    padding: 16,
    paddingBottom: 32,
    gap: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
  },
  help: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 21,
  },
  mono: {
    fontFamily: "monospace",
    fontSize: 13,
    color: "#0f766e",
    backgroundColor: "#ecfdf5",
    padding: 10,
    borderRadius: 8,
  },
  label: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
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
    marginTop: 18,
    backgroundColor: "#15803d",
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
});
