import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../../theme.js";
import { StatusChip } from "./StatusChip.jsx";

function fmt(v) {
  const s = v == null ? "" : String(v).trim();
  return s ? s : "—";
}

function RecordListCardInner({ item, onPress, formatDate, formatQty, slaTotalDays, formatHolderLine, gridMode }) {
  const lvl = item.computed_alert_level || item.alert_level || "green";
  const sla =
    typeof item.sla_total_days === "number"
      ? `${item.sla_total_days}d SLA`
      : slaTotalDays(item.entry_date, item.due_date) != null
        ? `${slaTotalDays(item.entry_date, item.due_date)}d SLA`
        : null;
  const meta = [
    item.current_stage != null ? `Stage ${item.current_stage}` : null,
    formatQty(item.quantity, item.unit),
    item.entry_date ? `Entry ${formatDate(item.entry_date)}` : null,
    item.due_date ? `Due ${formatDate(item.due_date)}` : null,
    sla,
    item.current_department_name ? String(item.current_department_name).trim() : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, gridMode && styles.cardGrid, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={styles.top}>
        <Text style={styles.title} numberOfLines={1}>
          {item.record_number}
          {item.needs_workflow_correction ? " · FIX" : ""}
          {item.viewer_forwarded ? " · Forwarded" : ""}
        </Text>
        <StatusChip level={lvl} compact />
      </View>
      <Text style={styles.sub} numberOfLines={1}>
        {fmt(item.vendor_name)} · {fmt(item.product_type)}
        {item.packaging ? ` · ${fmt(item.packaging)}` : ""}
      </Text>
      <Text style={styles.meta} numberOfLines={2}>
        {meta}
      </Text>
      <Text style={styles.holder} numberOfLines={1}>
        {formatHolderLine(item)}
        {item.driver_name ? ` · ${fmt(item.driver_name)}` : ""}
        {item.vehicle_details ? ` · ${fmt(item.vehicle_details)}` : ""}
        {item.photo_path ? " · Photo" : ""}
      </Text>

      {item.viewer_forwarded ? (
        <View style={styles.forwardedNotice}>
          <Text style={styles.forwardedTitle}>Forwarded</Text>
          <Text style={styles.forwardedText} numberOfLines={2}>
            With {formatHolderLine(item)}. You can view this record but cannot edit or forward it.
          </Text>
        </View>
      ) : null}

      {item.pending_return_feedback ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>Fix requested</Text>
          <Text style={styles.noticeText} numberOfLines={2}>
            {String(item.pending_return_feedback)}
          </Text>
        </View>
      ) : null}
      {item.needs_workflow_correction && !item.pending_return_feedback ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Needs workflow correction</Text>
        </View>
      ) : null}
      {item.remarks ? (
        <Text style={styles.remarks} numberOfLines={2}>
          {String(item.remarks)}
        </Text>
      ) : null}
    </Pressable>
  );
}

export const RecordListCard = memo(RecordListCardInner);

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.space.md,
    marginVertical: 4,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardGrid: {
    marginHorizontal: 0,
    flex: 1,
    minWidth: 0,
  },
  pressed: { opacity: 0.92, backgroundColor: theme.colors.surfaceMuted },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.space.xs,
  },
  title: { flex: 1, ...theme.type.h3, fontWeight: "700" },
  sub: { ...theme.type.body, marginTop: 4, fontSize: 13 },
  meta: { ...theme.type.caption, marginTop: 4, lineHeight: 17 },
  holder: { ...theme.type.micro, marginTop: 4 },
  remarks: { ...theme.type.caption, marginTop: 6, fontStyle: "italic" },
  notice: {
    marginTop: theme.space.xs,
    padding: theme.space.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.alert.yellow.bg,
    borderWidth: 1,
    borderColor: "rgba(217, 119, 6, 0.2)",
  },
  noticeTitle: { fontSize: 11, fontWeight: "700", color: theme.colors.alert.yellow.fg },
  noticeText: { fontSize: 11, color: theme.colors.alert.yellow.fg, marginTop: 2 },
  forwardedNotice: {
    marginTop: theme.space.xs,
    padding: theme.space.xs,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(59, 130, 246, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.22)",
  },
  forwardedTitle: { fontSize: 11, fontWeight: "700", color: theme.colors.accentHover },
  forwardedText: { fontSize: 11, color: theme.colors.text, marginTop: 2, lineHeight: 15 },
});
