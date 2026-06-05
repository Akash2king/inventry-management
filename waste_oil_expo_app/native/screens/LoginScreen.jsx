import React, { useState } from "react";
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
import { Button, Card, FadeIn, KeyboardAwareScroll } from "../components/ui/index.js";
import { showError, showBlockingError } from "../utils/feedback.js";
import { useResponsive } from "../utils/responsive.js";
import { ContentWidth } from "../components/ui/ContentWidth.jsx";
import { useResponsiveType } from "../utils/typography.js";

export function LoginScreen({ navigation }) {
  const { login, api, apiBase } = useAuth();
  const { formMaxWidth } = useResponsive();
  const type = useResponsiveType();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin() {
    if (!api) {
      showBlockingError(
        "Set API URL first",
        "Open Settings and enter your Django API base (LAN), e.g. http://192.168.1.5:8000/api/v1",
      );
      return;
    }
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      showError(e?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAwareScroll
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardVerticalOffset={0}
      >
        <ContentWidth style={{ maxWidth: formMaxWidth }}>
        <FadeIn>
        <Card style={styles.card} variant="strong">
          <Text style={[styles.brand, type.title]}>Chem-Solv Inventory</Text>
          <Text style={[styles.sub, type.body]}>Native • same network as backend</Text>
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
          <Text style={[styles.label, type.label]}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            editable={Boolean(api)}
            style={[styles.input, type.input, type.inputPad]}
          />
          <Text style={[styles.label, type.label]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={Boolean(api)}
            style={[styles.input, type.input, type.inputPad]}
          />
          <Button
            title="Sign in"
            onPress={() => void handleLogin()}
            loading={busy}
            disabled={!api || busy}
          />
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => navigation.navigate("Settings")}
          >
            <Text style={styles.secondaryText}>API Settings</Text>
          </TouchableOpacity>
        </Card>
        </FadeIn>
        </ContentWidth>
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingVertical: 20,
  },
  card: {
    padding: theme.space.xl,
  },
  brand: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.textBright,
  },
  sub: {
    marginTop: 4,
    color: theme.colors.text,
    fontSize: 14,
    marginBottom: 16,
  },
  banner: {
    backgroundColor: theme.colors.accentMuted,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "rgba(15, 118, 110, 0.22)",
    padding: 12,
    marginBottom: 16,
  },
  bannerText: {
    color: theme.colors.textBright,
    fontSize: 14,
  },
  bannerLink: {
    marginTop: 8,
    color: theme.colors.accentHover,
    fontWeight: "900",
  },
  endpoint: {
    fontSize: 11,
    color: theme.colors.accentHover,
    marginBottom: 14,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  label: {
    fontSize: 13,
    fontWeight: "800",
    color: theme.colors.textBright,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    marginBottom: 14,
    color: theme.colors.textBright,
    backgroundColor: theme.colors.surface,
  },
  primary: {
    backgroundColor: theme.colors.accentHover,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  disabled: {
    opacity: 0.5,
  },
  primaryText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
  secondary: {
    marginTop: 14,
    alignItems: "center",
    padding: 10,
  },
  secondaryText: {
    color: theme.colors.accentHover,
    fontWeight: "900",
    fontSize: 15,
  },
});
