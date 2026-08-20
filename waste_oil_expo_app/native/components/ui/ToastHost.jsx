import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../../store/uiStore.js";
import { theme } from "../../theme.js";

function ToastItem({ toast, onDismiss }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    return () => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    };
  }, [opacity, translateY]);

  const isError = toast.type === "error";
  const icon = isError ? "close-circle" : "checkmark-circle";

  return (
    <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]}>
      <Pressable
        style={[styles.inner, isError ? styles.error : styles.success]}
        onPress={() => onDismiss(toast.id)}
        accessibilityRole="button"
        accessibilityLabel={`Dismiss notification: ${toast.message}`}
      >
        <Ionicons name={icon} size={20} color={isError ? theme.colors.red : theme.colors.success} />
        <Text style={styles.msg} numberOfLines={3}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <View style={[styles.host, { top: insets.top + 8 }]} pointerEvents="box-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={dismissToast} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: theme.space.lg,
    right: theme.space.lg,
    zIndex: 9999,
    gap: theme.space.xs,
  },
  toast: {
    ...theme.shadow.md,
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.sm,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingVertical: theme.space.md,
    paddingHorizontal: theme.space.md,
    backgroundColor: theme.colors.surfaceStrong,
  },
  success: {
    borderColor: "rgba(22, 163, 74, 0.35)",
  },
  error: {
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  msg: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: theme.colors.textBright,
    lineHeight: 19,
  },
});
