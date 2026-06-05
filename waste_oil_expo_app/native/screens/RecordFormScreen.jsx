import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../AuthContext.jsx";
import { showSuccess, showError, showBlockingError, showConfirm } from "../utils/feedback.js";
import { Button, KeyboardAwareScroll, LoadingBlock, ModalHeader, ModalShell } from "../components/ui/index.js";
import { theme } from "../theme.js";
import { useScrollContentStyle } from "../utils/responsive.js";
import { useResponsiveType } from "../utils/typography.js";

function normalizeUuid(v) {
  return String(v || "").trim();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDateValue(date) {
  const d = date instanceof Date ? date : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDateValue(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ""));
  if (!m) return new Date();
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export function RecordFormScreen({ navigation, route }) {
  const { api } = useAuth();
  const scrollStyle = useScrollContentStyle({ gap: 12 });
  const type = useResponsiveType();
  const mode = route.params?.mode || "create";
  const recordId = route.params?.recordId ? String(route.params.recordId) : "";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [vendors, setVendors] = useState([]);
  const [options, setOptions] = useState({
    product_type: [],
    unit: [],
    packaging: [],
    driver_name: [],
  });

  const [vendorModal, setVendorModal] = useState(false);
  const [optionModal, setOptionModal] = useState(null); // { key }
  const [vendorSearch, setVendorSearch] = useState("");
  const [optionSearch, setOptionSearch] = useState("");
  const [newOption, setNewOption] = useState("");
  const [optionBusy, setOptionBusy] = useState(false);

  const [vendorId, setVendorId] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productType, setProductType] = useState("");
  const [unit, setUnit] = useState("");
  const [packaging, setPackaging] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entryDate, setEntryDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleDetails, setVehicleDetails] = useState("");
  const [remarks, setRemarks] = useState("");
  const [photoAsset, setPhotoAsset] = useState(null);
  const [datePicker, setDatePicker] = useState(null); // entry | due | null

  const vendorName = useMemo(() => {
    const row = vendors.find((v) => String(v.id) === String(vendorId));
    return row?.name || row?.vendor_name || "";
  }, [vendors, vendorId]);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      String(v.name || v.vendor_name || "")
        .toLowerCase()
        .includes(q),
    );
  }, [vendors, vendorSearch]);

  const load = useCallback(async () => {
    if (!api) return;
    const v = await api.vendors.list();
    if (v.ok && Array.isArray(v.data)) {
      setVendors(v.data);
    } else {
      setVendors([]);
    }

    const keys = ["product_type", "unit", "packaging", "driver_name"];
    const results = await Promise.all(keys.map((k) => api.records.listOptions({ category: k })));
    const next = {};
    keys.forEach((k, idx) => {
      const res = results[idx];
      next[k] = res.ok && Array.isArray(res.data) ? res.data : [];
    });
    setOptions((prev) => ({ ...prev, ...next }));

    if (mode === "edit" && recordId) {
      const r = await api.records.getById(recordId);
      if (r.ok && r.data) {
        const d = r.data;
        setVendorId(String(d.vendor_id || d.vendor?.id || ""));
        setProductDescription(d.product_description || "");
        setProductType(d.product_type || "");
        setUnit(d.unit || "");
        setPackaging(d.packaging || "");
        setQuantity(d.quantity != null ? String(d.quantity) : "");
        setEntryDate(d.entry_date || "");
        setDueDate(d.due_date || "");
        setDriverName(d.driver_name || "");
        setVehicleDetails(d.vehicle_details || "");
        setRemarks(d.remarks || "");
      } else {
        showBlockingError("Could not load record", r.error || "Unknown error");
      }
    } else if (mode === "create") {
      // defaults
      setEntryDate((p) => (p ? p : formatDateValue(new Date())));
    }

    setLoading(false);
  }, [api, mode, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showBlockingError("Permission needed", "Allow photo library permission to attach an entry photo.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled && res.assets?.[0]) {
      setPhotoAsset(res.assets[0]);
    }
  }

  function validate() {
    if (!normalizeUuid(vendorId)) return "Select a vendor";
    if (!String(productType).trim()) return "Product type is required";
    if (!String(unit).trim()) return "Unit is required";
    const qty = toNumber(quantity);
    if (qty == null || qty <= 0) return "Quantity must be positive";
    if (!String(entryDate).trim()) return "Entry date is required";
    return "";
  }

  async function submit() {
    if (!api) return;
    const err = validate();
    if (err) {
      showError(err);
      return;
    }
    setBusy(true);
    try {
      const payload = {
        vendor_id: normalizeUuid(vendorId),
        product_description: productDescription || "",
        product_type: productType,
        unit,
        packaging: packaging || "",
        quantity: Number(quantity),
        entry_date: entryDate,
        due_date: dueDate || "",
        driver_name: driverName || "",
        vehicle_details: vehicleDetails || "",
        remarks: remarks || "",
      };

      let saved;
      if (mode === "edit" && recordId) {
        saved = await api.records.update(recordId, payload);
      } else {
        saved = await api.records.create(payload);
      }
      if (!saved.ok) {
        throw new Error(saved.error || "Save failed");
      }

      const id = String(saved.data?.id || recordId || "");
      if (id && photoAsset) {
        const up = await api.records.uploadPhoto(id, photoAsset);
        if (!up.ok) {
          showError(up.error || "Saved, but photo upload failed");
        }
      }

      showSuccess("Record saved successfully.");
      navigation.goBack();
    } catch (e) {
      showError(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function openOptionPicker(key) {
    setOptionModal({ key });
  }

  function applyOption(key, value) {
    if (key === "product_type") setProductType(value);
    else if (key === "unit") setUnit(value);
    else if (key === "packaging") setPackaging(value);
    else if (key === "driver_name") setDriverName(value);
    setOptionModal(null);
    setOptionSearch("");
    setNewOption("");
  }

  function applyPickedDate(event, selectedDate) {
    const field = datePicker;
    if (Platform.OS === "android") {
      setDatePicker(null);
    }
    if (event?.type === "dismissed" || !selectedDate || !field) return;
    const next = formatDateValue(selectedDate);
    if (field === "entry") setEntryDate(next);
    if (field === "due") setDueDate(next);
  }

  async function createNewOption() {
    if (!api || !optionModal?.key) return;
    const val = newOption.trim();
    if (!val) return;
    setOptionBusy(true);
    try {
      const res = await api.records.createOption({ category: optionModal.key, value: val });
      if (!res.ok) throw new Error(res.error || "Could not create option");
      const list = await api.records.listOptions({ category: optionModal.key });
      if (list.ok && Array.isArray(list.data)) {
        setOptions((prev) => ({ ...prev, [optionModal.key]: list.data }));
      }
      applyOption(optionModal.key, val);
    } catch (e) {
      showError(e?.message || "Could not create option");
    } finally {
      setOptionBusy(false);
    }
  }

  async function deleteOptionRow(row) {
    if (!api || !optionModal?.key) return;
    if (!row?.id) return;
    const label = row.value || row.name || "";
    showConfirm({
      title: "Delete option",
      message: `Delete "${label}"?`,
      confirmText: "Delete",
      destructive: true,
      icon: "trash-outline",
      onConfirm: async () => {
        setOptionBusy(true);
        try {
          const res = await api.records.deleteOption(row.id);
          if (!res.ok) throw new Error(res.error || "Could not delete option");
          const list = await api.records.listOptions({ category: optionModal.key });
          if (list.ok && Array.isArray(list.data)) {
            setOptions((prev) => ({ ...prev, [optionModal.key]: list.data }));
          }
        } catch (e) {
          showError(e?.message || "Could not delete option");
        } finally {
          setOptionBusy(false);
        }
      },
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <LoadingBlock message="Loading form…" fullScreen />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAwareScroll contentContainerStyle={scrollStyle}>
        <Text style={[styles.title, type.title]}>{mode === "edit" ? "Edit record" : "New record"}</Text>

        <Text style={[styles.label, type.label]}>Vendor *</Text>
        <TouchableOpacity style={styles.select} onPress={() => setVendorModal(true)}>
          <Text style={styles.selectText} numberOfLines={1}>
            {vendorName || "Select vendor"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, type.label]}>Product description</Text>
        <TextInput
          value={productDescription}
          onChangeText={setProductDescription}
          style={[styles.input, type.input, type.inputPad, styles.multiline]}
          multiline
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
        />

        <Text style={[styles.label, type.label]}>Product type *</Text>
        <TouchableOpacity style={styles.select} onPress={() => openOptionPicker("product_type")}>
          <Text style={styles.selectText} numberOfLines={1}>
            {productType || "Select product type"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, type.label]}>Unit *</Text>
        <TouchableOpacity style={styles.select} onPress={() => openOptionPicker("unit")}>
          <Text style={styles.selectText} numberOfLines={1}>
            {unit || "Select unit"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, type.label]}>Packaging</Text>
        <TouchableOpacity style={styles.select} onPress={() => openOptionPicker("packaging")}>
          <Text style={styles.selectText} numberOfLines={1}>
            {packaging || "Select packaging"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, type.label]}>Quantity *</Text>
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          style={[styles.input, type.input, type.inputPad]}
          keyboardType="decimal-pad"
          placeholder="e.g. 1250.5"
          placeholderTextColor="#94a3b8"
        />

        <Text style={[styles.label, type.label]}>Entry date *</Text>
        <TouchableOpacity style={styles.dateSelect} onPress={() => setDatePicker("entry")}>
          <Text style={styles.selectText}>{entryDate || "Select entry date"}</Text>
          <Text style={styles.dateSelectHint}>Change</Text>
        </TouchableOpacity>

        <Text style={[styles.label, type.label]}>Due date</Text>
        <View style={styles.dateRow}>
          <TouchableOpacity style={[styles.dateSelect, { flex: 1 }]} onPress={() => setDatePicker("due")}>
            <Text style={styles.selectText}>{dueDate || "Select due date"}</Text>
            <Text style={styles.dateSelectHint}>Choose</Text>
          </TouchableOpacity>
          {dueDate ? (
            <TouchableOpacity style={styles.clearDateBtn} onPress={() => setDueDate("")}>
              <Text style={styles.clearDateText}>Clear</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.advHead}>
          <Text style={styles.advTitle}>More details (optional)</Text>
        </View>

        <Text style={[styles.label, type.label]}>Driver name</Text>
        <TouchableOpacity style={styles.select} onPress={() => openOptionPicker("driver_name")}>
          <Text style={styles.selectText} numberOfLines={1}>
            {driverName || "Select driver"}
          </Text>
        </TouchableOpacity>

        <Text style={[styles.label, type.label]}>Vehicle details</Text>
        <TextInput
          value={vehicleDetails}
          onChangeText={setVehicleDetails}
          style={[styles.input, type.input, type.inputPad]}
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
        />

        <Text style={[styles.label, type.label]}>Entry photo</Text>
        <TouchableOpacity style={styles.photoBtn} onPress={() => void pickPhoto()}>
          <Text style={styles.photoBtnText}>
            {photoAsset ? "Change photo" : "Pick a photo"}
          </Text>
        </TouchableOpacity>
        {photoAsset ? (
          <Text style={styles.hint} numberOfLines={2}>
            Selected: {photoAsset.fileName || photoAsset.uri}
          </Text>
        ) : null}

        <Text style={[styles.label, type.label]}>Remarks</Text>
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
          style={[styles.input, type.input, type.inputPad, styles.multiline]}
          multiline
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.actions}>
          <Button title="Save" onPress={() => void submit()} loading={busy} disabled={busy} />
          <TouchableOpacity style={styles.ghost} onPress={() => navigation.goBack()}>
            <Text style={styles.ghostText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScroll>

      {datePicker ? (
        <View style={Platform.OS === "ios" ? styles.iosPickerWrap : null}>
          {Platform.OS === "ios" ? (
            <View style={styles.iosPickerHead}>
              <TouchableOpacity onPress={() => setDatePicker(null)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <DateTimePicker
            value={parseDateValue(datePicker === "entry" ? entryDate : dueDate)}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={applyPickedDate}
          />
        </View>
      ) : null}

      <Modal visible={vendorModal} animationType="slide">
        <ModalShell style={styles.modalSafe}>
          <ModalHeader title="Select vendor" onClose={() => setVendorModal(false)} />
          <View style={styles.modalSearch}>
            <TextInput
              value={vendorSearch}
              onChangeText={setVendorSearch}
              placeholder="Search vendor…"
              placeholderTextColor="#94a3b8"
              style={[styles.input, { marginTop: 0 }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.modalList}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {filteredVendors.map((v) => (
              <TouchableOpacity
                key={String(v.id)}
                style={styles.modalRow}
                onPress={() => {
                  setVendorId(String(v.id));
                  setVendorModal(false);
                  setVendorSearch("");
                }}
              >
                <Text style={styles.modalRowTitle}>{v.name || v.vendor_name || "Vendor"}</Text>
                {v.notes ? <Text style={styles.modalRowSub}>{String(v.notes)}</Text> : null}
              </TouchableOpacity>
            ))}
            {filteredVendors.length === 0 ? (
              <Text style={styles.empty}>No vendors yet. Add vendors next.</Text>
            ) : null}
          </ScrollView>
        </ModalShell>
      </Modal>

      <Modal visible={Boolean(optionModal)} animationType="slide">
        <ModalShell style={styles.modalSafe}>
          <ModalHeader title="Select" onClose={() => setOptionModal(null)} />
          <View style={styles.modalSearch}>
            <TextInput
              value={optionSearch}
              onChangeText={setOptionSearch}
              placeholder="Search option…"
              placeholderTextColor="#94a3b8"
              style={[styles.input, { marginTop: 0 }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TextInput
                value={newOption}
                onChangeText={setNewOption}
                placeholder="Add new option…"
                placeholderTextColor="#94a3b8"
                style={[styles.input, { flex: 1, marginTop: 0 }]}
              />
              <TouchableOpacity
                style={[styles.primary, { paddingHorizontal: 14, paddingVertical: 12 }, optionBusy && styles.disabled]}
                disabled={optionBusy}
                onPress={() => void createNewOption()}
              >
                <Text style={{ color: "#fff", fontWeight: "900" }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          <ScrollView
            contentContainerStyle={styles.modalList}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            {(optionModal?.key ? options[optionModal.key] : [])
              .filter((o) => {
                const q = optionSearch.trim().toLowerCase();
                if (!q) return true;
                const v = String(o.value || o.name || "").toLowerCase();
                return v.includes(q);
              })
              .map((o) => (
              <TouchableOpacity
                key={String(o.id || o.value || o.name)}
                style={styles.modalRow}
                onPress={() => applyOption(optionModal.key, o.value || o.name || "")}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={[styles.modalRowTitle, { flex: 1 }]}>{o.value || o.name || "—"}</Text>
                  {o.id ? (
                    <TouchableOpacity
                      onPress={() => void deleteOptionRow(o)}
                      disabled={optionBusy}
                      style={styles.delPill}
                    >
                      <Text style={styles.delPillText}>Del</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
            {optionModal?.key && (options[optionModal.key] || []).length === 0 ? (
              <Text style={styles.empty}>No options found. You can type values manually later.</Text>
            ) : null}
          </ScrollView>
        </ModalShell>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: theme.space.md, paddingBottom: 40, gap: 8 },
  title: { ...theme.type.title, marginBottom: 6 },
  label: { marginTop: 8, ...theme.type.caption, color: theme.colors.textBright, fontWeight: "600" },
  input: {
    marginTop: 6,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    color: theme.colors.textBright,
  },
  multiline: { minHeight: 80, textAlignVertical: "top" },
  select: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  selectText: { color: theme.colors.textBright, fontSize: 16, fontWeight: "600" },
  dateRow: { flexDirection: "row", alignItems: "stretch", gap: 10 },
  dateSelect: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dateSelectHint: { color: theme.colors.accent, fontSize: 12, fontWeight: "700" },
  clearDateBtn: {
    marginTop: 6,
    minWidth: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  clearDateText: { color: "#475569", fontSize: 12, fontWeight: "900" },
  iosPickerWrap: {
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingBottom: 10,
  },
  iosPickerHead: {
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  advHead: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  advTitle: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  photoBtn: {
    marginTop: 6,
    backgroundColor: theme.colors.accentSoft,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  photoBtnText: { color: theme.colors.accentHover, fontWeight: "700" },
  hint: { marginTop: 6, fontSize: 12, color: "#64748b" },
  actions: { marginTop: 18, gap: 10 },
  primary: {
    backgroundColor: "#15803d",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  ghost: { paddingVertical: 12, alignItems: "center" },
  ghostText: { color: "#475569", fontWeight: "800" },
  disabled: { opacity: 0.55 },
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
  modalClose: { color: theme.colors.accent, fontWeight: "700" },
  modalSearch: {
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    gap: 10,
  },
  modalList: { padding: 12, gap: 10 },
  modalRow: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  modalRowTitle: { fontSize: 15, fontWeight: "900", color: "#0f172a" },
  modalRowSub: { marginTop: 4, fontSize: 12, color: "#64748b" },
  empty: { textAlign: "center", color: "#64748b", padding: 16 },
  delPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.25)",
  },
  delPillText: { color: "#b91c1c", fontWeight: "900", fontSize: 12 },
});

