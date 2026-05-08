import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { canActEdit, canActForward, canActReturn } from "../../src/utils/permissions.js";
import { formatHolderLine } from "../../src/utils/holderDisplay.js";
import { STAGE_LABELS } from "../../src/utils/stageLabels.js";
import { nextStageName, prevStageName } from "../../src/utils/stageLabels.js";
import { theme } from "../theme.js";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { fromByteArray } from "base64-js";

function uint8ToBase64(bytes) {
  try {
    return fromByteArray(bytes);
  } catch {
    return "";
  }
}

async function ensureDocsDir() {
  const dir = `${FileSystem.documentDirectory}downloads/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

function formatTs(isoTs) {
  try {
    const d = new Date(isoTs);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

function actionLabel(t) {
  if (t?.transition_type === "return") return "Returned";
  if (t?.to_stage === 5 && t?.from_stage === 5) return "Final approval";
  return "Forwarded";
}

function actorLabel(t) {
  const name = String(t?.transitioned_by_name || "").trim();
  const un = String(t?.transitioned_by_username || "").trim();
  if (name && un && name !== un) return `${name} (@${un})`;
  if (name) return name;
  if (un) return `@${un}`;
  return "—";
}

export function RecordDetailScreen({ navigation, route }) {
  const { recordId } = route.params || {};
  const autoOpen = route.params?.autoOpen || "";
  const { api, user } = useAuth();
  const mustChangePassword = Boolean(user?.must_change_password);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fwdOpen, setFwdOpen] = useState(false);
  const [retOpen, setRetOpen] = useState(false);
  const [fwdNote, setFwdNote] = useState("");
  const [retReason, setRetReason] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [transitions, setTransitions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [candidatePickerOpen, setCandidatePickerOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [photoUri, setPhotoUri] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoModal, setPhotoModal] = useState(false);

  const load = useCallback(async () => {
    if (!api || !recordId) return;
    const [res, tr] = await Promise.all([
      api.records.getById(recordId),
      api.workflow.getTransitions(recordId),
    ]);
    if (res.ok && res.data) setRecord(res.data);
    else {
      setRecord(null);
      Alert.alert("Could not load record", res.error || "Unknown error");
    }
    if (tr.ok && Array.isArray(tr.data)) setTransitions(tr.data);
    else setTransitions([]);
    setLoading(false);
  }, [api, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoOpen) return;
    if (autoOpen === "forward") setFwdOpen(true);
    if (autoOpen === "return") setRetOpen(true);
  }, [autoOpen]);

  useEffect(() => {
    let cancelled = false;
    if (!api || !recordId) return undefined;
    if (!record?.photo_path) {
      setPhotoUri("");
      return undefined;
    }
    (async () => {
      try {
        const res = await api.records.getEntryPhoto(recordId);
        if (cancelled) return;
        if (!res.ok || !res.data) return;
        // Guard: sometimes server returns JSON error body.
        if (res.contentType && res.contentType.includes("application/json")) return;
        const base64 = uint8ToBase64(res.data);
        if (!base64) return;
        const ext = res.contentType?.includes("png") ? "png" : "jpg";
        const dir = await ensureDocsDir();
        const uri = `${dir}entry_photo_${String(recordId)}.${ext}`;
        await FileSystem.writeAsStringAsync(uri, base64, { encoding: "base64" });
        if (!cancelled) setPhotoUri(uri);
      } catch {
        if (!cancelled) setPhotoUri("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, recordId, record?.photo_path]);

  async function sharePhoto() {
    if (!photoUri) return;
    setPhotoBusy(true);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(photoUri, { dialogTitle: "Share entry photo" });
      } else {
        Alert.alert("Saved", `Saved to cache:\n${photoUri}`);
      }
    } finally {
      setPhotoBusy(false);
    }
  }

  async function submitForward() {
    if (!api) return;
    setActionBusy(true);
    const res = await api.workflow.forward(recordId, {
      note: fwdNote,
      next_holder_id: selectedCandidateId || undefined,
    });
    setActionBusy(false);
    if (res.ok) {
      setFwdOpen(false);
      setFwdNote("");
      setSelectedCandidateId("");
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
  const showEdit = !mustChangePassword && canActEdit(record, user);
  const showFwd = !mustChangePassword && canActForward(record, user);
  const showRet = !mustChangePassword && canActReturn(record, user);
  const selectedCandidate = candidates.find((c) => String(c?.id) === String(selectedCandidateId));
  const holderLabel = formatHolderLine(record);
  const stageName =
    record?.current_stage != null
      ? STAGE_LABELS[Math.max(0, Number(record.current_stage) - 1)] || `Stage ${record.current_stage}`
      : "—";
  const nextStage =
    record?.current_stage != null ? nextStageName(Number(record.current_stage)) : "—";
  const prevStage =
    record?.current_stage != null ? prevStageName(Number(record.current_stage)) : "";

  const actionHint = mustChangePassword
    ? "You must change your password before taking actions. Viewing is allowed."
    : locked
      ? "This record is completed (locked)."
      : holderLabel !== "—"
        ? `Only the current holder (${holderLabel}) can edit/forward/return.`
        : "Actions are available only when your role matches the current stage.";

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

        {record.photo_path ? (
          <View style={styles.photoBlock}>
            {photoUri ? (
              <TouchableOpacity onPress={() => setPhotoModal(true)}>
                <Image source={{ uri: photoUri }} style={styles.photo} />
              </TouchableOpacity>
            ) : (
              <View style={[styles.photo, { backgroundColor: "#e2e8f0" }]} />
            )}
            <View style={styles.photoActions}>
              <TouchableOpacity style={styles.photoBtn} onPress={() => setPhotoModal(true)} disabled={!photoUri}>
                <Text style={styles.photoBtnText}>View</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoBtn} onPress={() => void sharePhoto()} disabled={!photoUri || photoBusy}>
                <Text style={styles.photoBtnText}>{photoBusy ? "…" : "Share"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <Text style={styles.line}>
          Vendor: {record.vendor_name || record.vendor?.name || "—"}
        </Text>
        <Text style={styles.line}>Stage: {record.current_stage} — {stageName}</Text>
        <Text style={styles.line}>Alert: {record.alert_level || "—"}</Text>
        <Text style={styles.line}>Qty: {record.quantity ?? "—"} {record.unit || ""}</Text>
        <Text style={styles.line}>Department: {record.current_department_name || "—"}</Text>
        <Text style={styles.line}>Current holder: {holderLabel}</Text>
        {record.remarks ? <Text style={styles.block}>Remarks: {record.remarks}</Text> : null}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>Workflow timeline</Text>
          <Text style={styles.sectionSub}>
            {transitions.length ? `${transitions.length} event(s)` : "No events yet"}
          </Text>
        </View>
        {transitions.length ? (
          <View style={styles.timeline}>
            {transitions.slice(0).reverse().slice(0, 12).map((t, idx) => (
              <View key={String(t.id || idx)} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>
                    {actionLabel(t)} · Stage {t.from_stage}→{t.to_stage}
                  </Text>
                  <Text style={styles.timelineMeta} numberOfLines={2}>
                    {actorLabel(t)} · {formatTs(t.timestamp)}
                  </Text>
                  {t.note ? (
                    <Text style={styles.timelineNote} numberOfLines={3}>
                      {String(t.note)}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.mutedSmall}>No workflow transitions recorded yet.</Text>
        )}

        {!locked ? (
          <View style={styles.actions}>
            {showEdit ? (
              <TouchableOpacity
                style={styles.ghostBtn}
                onPress={() =>
                  navigation.navigate("RecordForm", { mode: "edit", recordId })
                }
              >
                <Text style={styles.ghostBtnTxt}>Edit</Text>
              </TouchableOpacity>
            ) : null}
            {showRet ? (
              <TouchableOpacity style={styles.danger} onPress={() => setRetOpen(true)}>
                <Text style={styles.dangerTxt}>Return</Text>
              </TouchableOpacity>
            ) : null}
            {showFwd ? (
              <TouchableOpacity style={styles.primary} onPress={() => setFwdOpen(true)}>
                <Text style={styles.primaryTxt}>Forward</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <Text style={styles.muted}>This record is completed (locked).</Text>
        )}

        {!showEdit && !showFwd && !showRet ? (
          <Text style={styles.mutedSmall}>{actionHint}</Text>
        ) : null}

        {transitions.length > 12 ? (
          <TouchableOpacity
            style={styles.fullTimelineBtn}
            onPress={() =>
              navigation.navigate("WorkflowTimeline", {
                recordId,
                title: `${record.record_number} timeline`,
              })
            }
          >
            <Text style={styles.fullTimelineText}>View full timeline</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={photoModal} animationType="slide" onRequestClose={() => setPhotoModal(false)}>
        <SafeAreaView style={styles.pickerSafe} edges={["bottom"]}>
          <View style={styles.pickerHead}>
            <Text style={styles.pickerTitle}>Entry photo</Text>
            <TouchableOpacity onPress={() => setPhotoModal(false)}>
              <Text style={styles.pickerClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, backgroundColor: "#0b1220", justifyContent: "center" }}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoFull} resizeMode="contain" />
            ) : (
              <ActivityIndicator size="large" color="#fff" />
            )}
          </View>
          <View style={{ padding: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e2e8f0" }}>
            <TouchableOpacity style={styles.modalPrimary} onPress={() => void sharePhoto()} disabled={!photoUri || photoBusy}>
              <Text style={styles.primaryTxt}>{photoBusy ? "…" : "Share / download"}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={fwdOpen}
        animationType="slide"
        transparent
        onShow={async () => {
          if (!api) return;
          // Lazy-load candidates only when opening forward.
          const res = await api.workflow.getForwardCandidates(recordId);
          if (res.ok && Array.isArray(res.data)) setCandidates(res.data);
          else setCandidates([]);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Forward</Text>
            <Text style={styles.modalHint}>Next stage: {nextStage}</Text>
            <TouchableOpacity
              style={styles.modalSelect}
              onPress={() => setCandidatePickerOpen(true)}
            >
              <Text style={styles.modalSelectText} numberOfLines={1}>
                {selectedCandidate
                  ? `Next holder: ${selectedCandidate.full_name || selectedCandidate.username || selectedCandidate.id}`
                  : "Next holder (optional)"}
              </Text>
            </TouchableOpacity>
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
            {prevStage ? <Text style={styles.modalHint}>Back to: {prevStage}</Text> : null}
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

      <Modal visible={candidatePickerOpen} animationType="slide" onRequestClose={() => setCandidatePickerOpen(false)}>
        <SafeAreaView style={styles.pickerSafe} edges={["bottom"]}>
          <View style={styles.pickerHead}>
            <Text style={styles.pickerTitle}>Choose next holder</Text>
            <TouchableOpacity onPress={() => setCandidatePickerOpen(false)}>
              <Text style={styles.pickerClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.pickerList}>
            <TouchableOpacity
              style={styles.pickerRow}
              onPress={() => {
                setSelectedCandidateId("");
                setCandidatePickerOpen(false);
              }}
            >
              <Text style={styles.pickerRowTitle}>No specific holder</Text>
              <Text style={styles.pickerRowSub}>Let the system assign at next stage.</Text>
            </TouchableOpacity>
            {candidates.map((c) => (
              <TouchableOpacity
                key={String(c.id)}
                style={styles.pickerRow}
                onPress={() => {
                  setSelectedCandidateId(String(c.id));
                  setCandidatePickerOpen(false);
                }}
              >
                <Text style={styles.pickerRowTitle}>{c.full_name || c.username || `User ${String(c.id).slice(0, 8)}`}</Text>
                <Text style={styles.pickerRowSub} numberOfLines={2}>
                  {(c.department_name ? `${c.department_name} · ` : "") + (c.role || "")}
                </Text>
              </TouchableOpacity>
            ))}
            {candidates.length === 0 ? (
              <Text style={styles.mutedSmall}>No forward candidates available for this stage.</Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.bg,
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
  photoBlock: { gap: 10, marginBottom: 8 },
  photo: {
    width: "100%",
    height: 200,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  photoActions: { flexDirection: "row", gap: 10 },
  photoBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    alignItems: "center",
  },
  photoBtnText: { fontWeight: "900", color: theme.colors.accentHover },
  photoFull: { width: "100%", height: "100%" },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: theme.colors.textBright,
  },
  line: {
    fontSize: 15,
    color: theme.colors.textBright,
  },
  block: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 22,
  },
  muted: {
    color: theme.colors.text,
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  mutedSmall: {
    marginTop: 8,
    color: theme.colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  fullTimelineBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: 12,
    alignItems: "center",
  },
  fullTimelineText: { color: theme.colors.accentHover, fontWeight: "900" },
  sectionHead: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: theme.colors.textBright },
  sectionSub: { fontSize: 12, color: theme.colors.text },
  timeline: {
    marginTop: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 10,
  },
  timelineRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
    backgroundColor: theme.colors.accentMuted,
    borderWidth: 1,
    borderColor: "rgba(22, 163, 74, 0.40)",
  },
  timelineTitle: { fontSize: 13, fontWeight: "900", color: theme.colors.textBright },
  timelineMeta: { marginTop: 2, fontSize: 12, color: theme.colors.text },
  timelineNote: {
    marginTop: 6,
    fontSize: 12,
    color: theme.colors.textBright,
    lineHeight: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
    flexWrap: "wrap",
  },
  ghostBtn: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  ghostBtnTxt: { color: theme.colors.textBright, fontWeight: "900" },
  primary: {
    backgroundColor: theme.colors.accentHover,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryTxt: { color: "#fff", fontWeight: "900" },
  danger: {
    backgroundColor: theme.colors.red,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  dangerTxt: { color: "#fff", fontWeight: "900" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.colors.textBright,
  },
  modalHint: {
    marginTop: -6,
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: "700",
  },
  modalSelect: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
  },
  modalSelectText: { color: theme.colors.textBright, fontWeight: "900" },
  modalInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 15,
    color: theme.colors.textBright,
    backgroundColor: theme.colors.surface,
  },
  modalPrimary: {
    backgroundColor: theme.colors.accentHover,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  modalGhost: {
    paddingVertical: 10,
    alignItems: "center",
  },
  ghostTxt: {
    color: theme.colors.text,
    fontWeight: "800",
  },
  pickerSafe: { flex: 1, backgroundColor: theme.colors.bg },
  pickerHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerTitle: { fontSize: 16, fontWeight: "900", color: theme.colors.textBright },
  pickerClose: { color: theme.colors.accentHover, fontWeight: "900" },
  pickerList: { padding: 12, gap: 10 },
  pickerRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
  },
  pickerRowTitle: { fontSize: 14, fontWeight: "900", color: theme.colors.textBright },
  pickerRowSub: { marginTop: 4, fontSize: 12, color: theme.colors.text },
});
