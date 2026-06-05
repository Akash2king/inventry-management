import React, { memo } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { theme } from "../../theme.js";
import { StatusChip } from "./StatusChip.jsx";

function QueueListCardInner({
  item,
  user,
  copy,
  onOpen,
  onForward,
  onReturn,
  canActForward,
  canActReturn,
  formatDate,
  formatQty,
  slaTotalDays,
  gridMode,
}) {
  const lvl = item.computed_alert_level || item.alert_level || "green";
  const sla =
    slaTotalDays(item.entry_date, item.due_date) != null
      ? `SLA ${slaTotalDays(item.entry_date, item.due_date)}d`
      : null;

  return (
    <View style={[styles.card, gridMode && styles.cardGrid]}>
      <Pressable onPress={onOpen} style={({ pressed }) => pressed && styles.pressed}>
        <View style={styles.top}>
          <Text style={styles.title} numberOfLines={1}>
            {item.record_number}
          </Text>
          <StatusChip level={lvl} compact />
        </View>
        {item.pending_return_feedback ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Fix requested</Text>
            <Text style={styles.noticeText} numberOfLines={2}>
              {String(item.pending_return_feedback)}
            </Text>
          </View>
        ) : null}
        <Text style={styles.sub} numberOfLines={2}>
          {(item.vendor_name || "—") +
            ` · Stage ${item.current_stage}` +
            (item.current_department_name ? ` · ${item.current_department_name}` : "")}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {formatQty(item.quantity, item.unit)} · Entry {formatDate(item.entry_date)}
          {sla ? ` · ${sla}` : ""} · Due {formatDate(item.due_date)}
        </Text>
        {item.is_locked ? (
          <Text style={styles.locked}>Locked</Text>
        ) : null}
      </Pressable>

      {!item.is_locked ? (
        <View style={styles.actions}>
          {canActForward(item, user) ? (
            <TouchableOpacity style={styles.primary} onPress={onForward}>
              <Text style={styles.actionText}>{copy.forward}</Text>
            </TouchableOpacity>
          ) : null}
          {canActReturn(item, user) ? (
            <TouchableOpacity style={styles.danger} onPress={onReturn}>
              <Text style={styles.actionText}>{copy.return}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const QueueListCard = memo(QueueListCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.space.md,
    marginVertical: 4,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  cardGrid: {
    marginHorizontal: 0,
    flex: 1,
    minWidth: 0,
  },
  pressed: { opacity: 0.94 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.xs,
    paddingHorizontal: theme.space.md,
    paddingTop: theme.space.md,
  },
  title: { flex: 1, ...theme.type.h3, fontWeight: "700" },
  sub: {
    ...theme.type.body,
    fontSize: 13,
    paddingHorizontal: theme.space.md,
    marginTop: 4,
  },
  meta: {
    ...theme.type.caption,
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.sm,
    marginTop: 4,
  },
  locked: {
    ...theme.type.micro,
    color: theme.colors.success,
    paddingHorizontal: theme.space.md,
    paddingBottom: theme.space.sm,
  },
  notice: {
    marginHorizontal: theme.space.md,
    marginTop: theme.space.xs,
    padding: theme.space.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.alert.yellow.bg,
  },
  noticeTitle: { fontSize: 11, fontWeight: "700", color: theme.colors.alert.yellow.fg },
  noticeText: { fontSize: 11, color: theme.colors.alert.yellow.fg, marginTop: 2 },
  actions: {
    flexDirection: "row",
    gap: theme.space.xs,
    padding: theme.space.sm,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    marginTop: theme.space.xs,
  },
  primary: {
    flex: 1,
    backgroundColor: theme.colors.accent,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    alignItems: "center",
  },
  danger: {
    flex: 1,
    backgroundColor: theme.colors.danger,
    paddingVertical: 10,
    borderRadius: theme.radius.sm,
    alignItems: "center",
  },
  actionText: { color: theme.colors.textInverse, fontWeight: "700", fontSize: 12 },
});
