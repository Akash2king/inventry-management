import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../AuthContext.jsx";

export function RecordDetailScreen({ navigation, route }) {
  const { recordId } = route.params || {};
  const { api } = useAuth();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fwdOpen, setFwdOpen] = useState(false);
  const [retOpen, setRetOpen] = useState(false);
  const [fwdNote, setFwdNote] = useState("");
  const [retReason, setRetReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    if (!api || !recordId) return;
    const res = await api.records.getById(recordId);
    if (res.ok && res.data) {
      setRecord(res.data);
    } else {
      setRecord(null);
      Alert.alert("Could not load record", res.error || "Unknown error");
    }
    setLoading(false);
  }, [api, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submitForward() {
    if (!api) return;
    setActionBusy(true);
    const res = await api.workflow.forward(recordId, { note: fwdNote });
    setActionBusy(false);
    if (res.ok) {
      setFwdOpen(false);
      setFwdNote("");
      await load();
      Alert.alert("Forwarded", "Workflow updated.");
    } else {
      Alert.alert("Forward failed", res.error || "");
    }
  }

  async function submitReturn() {
    if (!api) return;
    setActionBusy(true);
    const res = await api.workflow.returnRecord(recordId, retReason || "Return");
    setActionBusy(false);
    if (res.ok) {
      setRetOpen(false);
      setRetReason("");
      await load();
      Alert.alert("Returned", "Workflow updated.");
    } else {
      Alert.alert("Return failed", res.error || "");
    }
  }

  const locked = Boolean(record?.is_locked);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!record) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Record not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{record.record_number}</Text>
        <Text style={styles.line}>
          Vendor: {record.vendor_name || record.vendor?.name || "—"}
        </Text>
        <Text style={styles.line}>Stage: {record.current_stage}</Text>
        <Text style={styles.line}>Alert: {record.alert_level || "—"}</Text>
        <Text style={styles.line}>Qty: {record.quantity ?? "—"} {record.unit || ""}</Text>
        <Text style={styles.line}>Department: {record.current_department_name || "—"}</Text>
        {record.remarks ? <Text style={styles.block}>Remarks: {record.remarks}</Text> : null}

        {!locked ? (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primary} onPress={() => setFwdOpen(true)}>
              <Text style={styles.primaryTxt}>Forward</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.danger} onPress={() => setRetOpen(true)}>
              <Text style={styles.dangerTxt}>Return</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.muted}>This record is completed (locked).</Text>
        )}
      </ScrollView>

      <Modal visible={fwdOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Forward</Text>
            <TextInput
              placeholder="Note (optional)"
              value={fwdNote}
              onChangeText={setFwdNote}
              style={styles.modalInput}
              multiline
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity
              style={styles.modalPrimary}
              disabled={actionBusy}
              onPress={() => void submitForward()}
            >
              <Text style={styles.primaryTxt}>{actionBusy ? "…" : "Submit forward"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalGhost} onPress={() => setFwdOpen(false)}>
              <Text style={styles.ghostTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={retOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Return</Text>
            <TextInput
              placeholder="Reason"
              value={retReason}
              onChangeText={setRetReason}
              style={styles.modalInput}
              multiline
              placeholderTextColor="#94a3b8"
            />
            <TouchableOpacity
              style={[styles.modalPrimary, styles.danger]}
              disabled={actionBusy}
              onPress={() => void submitReturn()}
            >
              <Text style={styles.primaryTxt}>{actionBusy ? "…" : "Submit return"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalGhost} onPress={() => setRetOpen(false)}>
              <Text style={styles.ghostTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    padding: 16,
    paddingBottom: 48,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
  },
  line: {
    fontSize: 15,
    color: "#334155",
  },
  block: {
    marginTop: 12,
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
  },
  muted: {
    color: "#64748b",
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    flexWrap: "wrap",
  },
  primary: {
    backgroundColor: "#15803d",
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryTxt: { color: "#fff", fontWeight: "700" },
  danger: {
    backgroundColor: "#b91c1c",
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  dangerTxt: { color: "#fff", fontWeight: "700" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 15,
    color: "#0f172a",
  },
  modalPrimary: {
    backgroundColor: "#15803d",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalGhost: {
    paddingVertical: 10,
    alignItems: "center",
  },
  ghostTxt: {
    color: "#475569",
    fontWeight: "600",
  },
});
