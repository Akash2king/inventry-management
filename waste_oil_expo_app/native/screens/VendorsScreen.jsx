import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export function VendorsScreen() {
  const { api, user } = useAuth();
  const canManage = useMemo(
    () => ["storeman", "gm", "superadmin"].includes(user?.role || ""),
    [user?.role],
  );

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeVendor, setActiveVendor] = useState(null);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!api) return;
    const res = await api.vendors.list();
    if (res.ok) {
      const list = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.results) ? res.data.results : [];
      setRows(list);
    } else {
      setRows([]);
    }
    setLoading(false);
    setRefreshing(false);
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
      Alert.alert("Missing name", "Vendor name is required.");
      return;
    }
    setBusy(true);
    const res = await api.vendors.create({ name: name.trim(), notes: notes.trim() });
    setBusy(false);
    if (res.ok) {
      closeModals();
      await load();
      Alert.alert("Saved", "Vendor added.");
    } else {
      Alert.alert("Save failed", res.error || "Could not save vendor.");
    }
  };

  const saveEdit = async () => {
    if (!api) return;
    if (!activeVendor?.id) return;
    if (!name.trim()) {
      Alert.alert("Missing name", "Vendor name is required.");
      return;
    }
    setBusy(true);
    const res = await api.vendors.update(activeVendor.id, { name: name.trim(), notes: notes.trim() });
    setBusy(false);
    if (res.ok) {
      closeModals();
      await load();
      Alert.alert("Saved", "Vendor updated.");
    } else {
      Alert.alert("Update failed", res.error || "Could not update vendor.");
    }
  };

  const removeVendor = async (v) => {
    if (!api) return;
    Alert.alert(
      "Delete vendor?",
      `Delete "${v?.name || "vendor"}"? This may fail if records reference it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const res = await api.vendors.remove(v.id);
            if (res.ok) {
              await load();
              Alert.alert("Deleted", "Vendor removed.");
            } else {
              Alert.alert("Delete failed", res.error || "Could not delete vendor.");
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top","bottom"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Vendors</Text>
          <Text style={styles.muted} numberOfLines={1}>
            Maintain vendor master data for record creation.
          </Text>
        </View>
        {canManage ? (
          <TouchableOpacity style={styles.headerBtn} onPress={openCreate}>
            <Text style={styles.headerBtnText}>Add</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
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
            <Text style={styles.empty}>No vendors yet. Pull to refresh.</Text>
          }
          contentContainerStyle={rows.length === 0 ? styles.emptyWrap : styles.listPad}
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
        <SafeAreaView style={styles.modalSafe} edges={["bottom"]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Add vendor</Text>
            <TouchableOpacity onPress={closeModals}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.label}>Name *</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Vendor name" placeholderTextColor="#94a3b8" />
            <Text style={styles.label}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} style={[styles.input, styles.multiline]} multiline placeholder="Optional notes" placeholderTextColor="#94a3b8" />
            <TouchableOpacity style={[styles.primary, busy && styles.disabled]} onPress={() => void saveCreate()} disabled={busy}>
              <Text style={styles.primaryText}>{busy ? "Saving…" : "Save vendor"}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal visible={editOpen} animationType="slide" onRequestClose={closeModals}>
        <SafeAreaView style={styles.modalSafe} edges={["bottom"]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Edit vendor</Text>
            <TouchableOpacity onPress={closeModals}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.label}>Name *</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Vendor name" placeholderTextColor="#94a3b8" />
            <Text style={styles.label}>Notes</Text>
            <TextInput value={notes} onChangeText={setNotes} style={[styles.input, styles.multiline]} multiline placeholder="Optional notes" placeholderTextColor="#94a3b8" />
            <TouchableOpacity style={[styles.primary, busy && styles.disabled]} onPress={() => void saveEdit()} disabled={busy}>
              <Text style={styles.primaryText}>{busy ? "Saving…" : "Save changes"}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
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
    backgroundColor: "#dcfce7",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  headerBtnText: { color: "#166534", fontWeight: "900", fontSize: 12 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  listPad: { paddingVertical: 8 },
  row: {
    backgroundColor: "#fff",
    marginHorizontal: 12,
    marginVertical: 6,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  rowTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
  rowSub: { marginTop: 4, fontSize: 13, color: "#64748b", lineHeight: 18 },
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

