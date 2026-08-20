import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useUiStore } from "../../store/uiStore.js";
import { theme } from "../../theme.js";
import { useResponsive } from "../../utils/responsive.js";

const VARIANTS = {
  default: {
    icon: "information-circle-outline",
    iconBg: theme.colors.accentSoft,
    iconColor: theme.colors.accent,
  },
  danger: {
    icon: "log-out-outline",
    iconBg: "rgba(239, 68, 68, 0.1)",
    iconColor: theme.colors.danger,
  },
  warning: {
    icon: "warning-outline",
    iconBg: "rgba(245, 158, 11, 0.12)",
    iconColor: theme.colors.warning,
  },
  success: {
    icon: "checkmark-circle-outline",
    iconBg: "rgba(5, 150, 105, 0.12)",
    iconColor: theme.colors.success,
  },
};

function DialogButton({ btn, onPress, stacked }) {
  const destructive = btn.style === "destructive";
  const cancel = btn.style === "cancel";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        stacked && styles.btnStacked,
        cancel && styles.btnCancel,
        destructive && styles.btnDanger,
        !cancel && !destructive && styles.btnPrimary,
        pressed && styles.btnPressed,
      ]}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.btnText,
          cancel && styles.btnCancelText,
          destructive && styles.btnDangerText,
          !cancel && !destructive && styles.btnPrimaryText,
        ]}
      >
        {btn.text}
      </Text>
    </Pressable>
  );
}

export function AppDialogHost() {
  const dialog = useUiStore((s) => s.dialog);
  const dismissDialog = useUiStore((s) => s.dismissDialog);
  const { dialogMaxWidth, horizontalPad } = useResponsive();
  const scale = useRef(new Animated.Value(0.92)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!dialog) return;
    scale.setValue(0.92);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [dialog, opacity, scale]);

  if (!dialog) return null;

  const variant = VARIANTS[dialog.variant] || VARIANTS.default;
  const iconName = dialog.icon || variant.icon;
  const stacked = dialog.buttons.length > 2;

  function pressButton(btn) {
    dismissDialog();
    btn.onPress?.();
  }

  function onBackdropPress() {
    if (!dialog.cancelable) return;
    const cancelBtn = dialog.buttons.find((b) => b.style === "cancel");
    if (cancelBtn) {
      pressButton(cancelBtn);
    } else {
      dismissDialog();
    }
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onBackdropPress}>
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackdropPress} accessibilityLabel="Dismiss dialog" />
        <Animated.View style={[styles.card, { maxWidth: dialogMaxWidth, marginHorizontal: horizontalPad }, { transform: [{ scale }] }]}>
          <View style={[styles.iconWrap, { backgroundColor: variant.iconBg }]}>
            <Ionicons name={iconName} size={28} color={variant.iconColor} />
          </View>
          {dialog.title ? (
            <Text style={styles.title} accessibilityRole="header">
              {dialog.title}
            </Text>
          ) : null}
          {dialog.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {dialog.buttons.map((btn, idx) => (
              <DialogButton
                key={`${btn.text}-${idx}`}
                btn={btn}
                stacked={stacked}
                onPress={() => pressButton(btn)}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: theme.space.lg,
  },
  card: {
    width: "100%",
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space.xl,
    paddingBottom: theme.space.lg,
    alignItems: "center",
    ...theme.shadow.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: theme.space.md,
  },
  title: {
    ...theme.type.h2,
    textAlign: "center",
    marginBottom: theme.space.xs,
  },
  message: {
    ...theme.type.body,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: theme.space.lg,
  },
  actions: {
    flexDirection: "row",
    gap: theme.space.sm,
    width: "100%",
  },
  actionsStacked: {
    flexDirection: "column",
  },
  btn: {
    flex: 1,
    minHeight: 46,
    borderRadius: theme.radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.space.md,
    paddingVertical: 12,
  },
  btnStacked: {
    flex: 0,
    width: "100%",
  },
  btnPrimary: {
    backgroundColor: theme.colors.accent,
  },
  btnDanger: {
    backgroundColor: theme.colors.danger,
  },
  btnCancel: {
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  btnPressed: { opacity: 0.88 },
  btnText: { fontSize: 15, fontWeight: "600" },
  btnPrimaryText: { color: theme.colors.textInverse },
  btnDangerText: { color: theme.colors.textInverse },
  btnCancelText: { color: theme.colors.textBright },
});
