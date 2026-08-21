import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";
import { theme } from "../theme.js";
import { Button, EmptyState, ErrorBanner, KeyboardAwareScroll, LoadingBlock, ModalHeader, ModalShell, PageHeader } from "../components/ui/index.js";
import { useResponsiveType } from "../utils/typography.js";
import { FLATLIST_PERF } from "../utils/listPerf.js";
import { showSuccess, showError, showConfirm } from "../utils/feedback.js";
import { useResponsive } from "../utils/responsive.js";

export function VendorsScreen() {
  const { api, user } = useAuth();
  const { listColumns, horizontalPad, contentMaxWidth, gridGap, formMaxWidth } = useResponsive();
  const type = useResponsiveType();
  const canManage = useMemo(
    () => ["storeman", "gm", "superadmin"].includes(user?.role || ""),
    [user?.role],
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeVendor, setActiveVendor] = useState(null);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!api) return;
    try {
      const res = await api.vendors.list();
      if (res.ok) {
        const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.results) ? res.data.results : [];
        setRows(list);
        setLoadError("");
      } else {
        setRows([]);
        setLoadError(res.error || "Could not load vendors.");
      }
    } catch (e) {
      setRows([]);
      setLoadError(e?.message || "Could not load vendors.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const openCreate = () => {
    setName("");
    setNotes("");
    setCreateOpen(true);
  };

  const openEdit = (v) => {
    setActiveVendor(v);
    setName(v?.name || "");
    setNotes(v?.notes || "");
    setEditOpen(true);
  };

  const closeModals = () => {
    setCreateOpen(false);
    setEditOpen(false);
    setActiveVendor(null);
  };

  const saveCreate = async () => {
    if (!api) return;
    if (!name.trim()) {
      showError("Vendor name is required.");
      return;
    }
    setBusy(true);
    const res = await api.vendors.create({ name: name.trim(), notes: notes.trim() });
    setBusy(false);
    if (res.ok) {
      closeModals();
      await load();
      showSuccess("Vendor added.");
    } else {
      showError(res.error || "Could not save vendor.");
    }
  };

  const saveEdit = async () => {
    if (!api) return;
    if (!activeVendor?.id) return;
    if (!name.trim()) {
      showError("Vendor name is required.");
      return;
    }
    setBusy(true);
    const res = await api.vendors.update(activeVendor.id, { name: name.trim(), notes: notes.trim() });
    setBusy(false);
    if (res.ok) {
      closeModals();
      await load();
      showSuccess("Vendor updated.");
    } else {
      showError(res.error || "Could not update vendor.");
    }
  };

  const removeVendor = async (v) => {
    if (!api) return;
    showConfirm({
      title: "Delete vendor?",
      message: `Delete "${v?.name || "vendor"}"? This may fail if records reference it.`,
      confirmText: "Delete",
      destructive: true,
      icon: "trash-outline",
      onConfirm: async () => {
        const res = await api.vendors.remove(v.id);
        if (res.ok) {
          await load();
          showSuccess("Vendor removed.");
        } else {
          showError(res.error || "Could not delete vendor.");
        }
      },
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
      <PageHeader
        title="Vendors"
        subtitle="Master data for record creation"
        right={
          canManage ? (
            <TouchableOpacity style={styles.headerBtn} onPress={openCreate}>
              <Text style={styles.headerBtnText}>Add</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {loading ? (
        <LoadingBlock message="Loading vendors…" />
      ) : (
        <FlatList
          data={rows}
          key={`vendors-${listColumns}`}
          numColumns={listColumns}
          columnWrapperStyle={listColumns > 1 ? { gap: gridGap, paddingHorizontal: horizontalPad } : undefined}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} />
          }
          {...FLATLIST_PERF}
          ListHeaderComponent={
            <ErrorBanner
              message={loadError}
              onRetry={() => {
                setLoading(true);
                void load();
              }}
            />
          }
          renderItem={({ item }) => (
            <View style={[styles.row, listColumns > 1 && styles.rowGrid]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => (canManage ? openEdit(item) : null)} disabled={!canManage}>
                <Text style={styles.rowTitle}>{item.name || "—"}</Text>
                <Text style={styles.rowSub} numberOfLines={2}>
                  {item.notes || "—"}
                </Text>
              </TouchableOpacity>
              {canManage ? (
                <View style={styles.rowActions}>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => openEdit(item)}>
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, styles.smallDanger]} onPress={() => void removeVendor(item)}>
                    <Text style={[styles.smallBtnText, styles.smallDangerText]}>Del</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            loadError ? null : (
              <EmptyState
                icon="business-outline"
                title="No vendors yet"
                message={canManage ? "Tap Add to create your first vendor." : "Pull to refresh."}
              />
            )
          }
          contentContainerStyle={[
            rows.length === 0 ? styles.emptyWrap : styles.listPad,
            { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" },
          ]}
        />
      )}

      {!canManage ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            View-only. Only storeman, GM, or superadmin can add/edit vendors.
          </Text>
        </View>
      ) : null}

      <Modal visible={createOpen} animationType="slide" onRequestClose={closeModals}>
        <ModalShell style={styles.modalSafe}>
          <ModalHeader title="Add vendor" onClose={closeModals} />
          <KeyboardAwareScroll
            contentContainerStyle={[styles.modalBody, { maxWidth: formMaxWidth, alignSelf: "center", width: "100%", paddingHorizontal: horizontalPad }]}
            keyboardVerticalOffset={0}
          >
            <Text style={[styles.label, type.label]}>Name *</Text>
            <TextInput value={name} onChangeText={setName} style={[styles.input, type.input, type.inputPad]} placeholder="Vendor name" placeholderTextColor="#94a3b8" />
            <Text style={[styles.label, type.label]}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} style={[styles.input, type.input, type.inputPad, styles.multiline]} multiline placeholder="Optional notes" placeholderTextColor="#94a3b8" />
            <Button title="Save vendor" onPress={() => void saveCreate()} loading={busy} disabled={busy} />
          </KeyboardAwareScroll>
        </ModalShell>
      </Modal>

      <Modal visible={editOpen} animationType="slide" onRequestClose={closeModals}>
        <ModalShell style={styles.modalSafe}>
          <ModalHeader title="Edit vendor" onClose={closeModals} />
          <KeyboardAwareScroll
            contentContainerStyle={[styles.modalBody, { maxWidth: formMaxWidth, alignSelf: "center", width: "100%", paddingHorizontal: horizontalPad }]}
            keyboardVerticalOffset={0}
          >
            <Text style={[styles.label, type.label]}>Name *</Text>
            <TextInput value={name} onChangeText={setName} style={[styles.input, type.input, type.inputPad]} placeholder="Vendor name" placeholderTextColor="#94a3b8" />
            <Text style={[styles.label, type.label]}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} style={[styles.input, type.input, type.inputPad, styles.multiline]} multiline placeholder="Optional notes" placeholderTextColor="#94a3b8" />
            <Button title="Save changes" onPress={() => void saveEdit()} loading={busy} disabled={busy} />
          </KeyboardAwareScroll>
        </ModalShell>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  rowWrap: {},
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
    gap: 8,
  },
  title: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  muted: { color: "#64748b", fontSize: 12, lineHeight: 18 },
  headerBtn: {
    backgroundColor: theme.colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.pill,
  },
  headerBtnText: { color: theme.colors.textInverse, fontWeight: "600", fontSize: 13 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listPad: { paddingVertical: theme.space.xs },
  row: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.space.md,
    marginVertical: 4,
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: "row",
    gap: theme.space.sm,
    alignItems: "flex-start",
  },
  rowGrid: {
    marginHorizontal: 0,
    flex: 1,
    minWidth: 0,
  },
  rowTitle: { ...theme.type.h3, fontWeight: "700" },
  rowSub: { marginTop: 4, ...theme.type.body, fontSize: 13 },
  rowActions: { gap: 8, alignItems: "flex-end" },
  smallBtn: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    borderRadius: 10,
  },
  smallBtnText: { fontSize: 12, fontWeight: "900", color: "#0f172a" },
  smallDanger: { backgroundColor: "#fff1f2", borderColor: "#fecdd3" },
  smallDangerText: { color: "#b91c1c" },
  emptyWrap: { flexGrow: 1, justifyContent: "center", padding: 24 },
  empty: { textAlign: "center", color: "#64748b", fontSize: 14 },
  notice: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  noticeText: { color: "#475569", fontSize: 12, textAlign: "center" },
  modalSafe: { flex: 1, backgroundColor: "#f8fafc" },
  modalHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  modalClose: { color: "#15803d", fontWeight: "900" },
  modalBody: { padding: 16, gap: 10 },
  label: { marginTop: 6, fontSize: 13, fontWeight: "900", color: "#334155" },
  input: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    color: "#0f172a",
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  primary: {
    marginTop: 16,
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  disabled: { opacity: 0.6 },
});

