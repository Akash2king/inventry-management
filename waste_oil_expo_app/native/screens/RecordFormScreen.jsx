import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../AuthContext.jsx";

function normalizeUuid(v) {
  return String(v || "").trim();
}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function RecordFormScreen({ navigation, route }) {
  const { api } = useAuth();
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
        Alert.alert("Could not load record", r.error || "Unknown error");
      }
    } else if (mode === "create") {
      // defaults
      const today = new Date();
      const iso = today.toISOString().slice(0, 10);
      setEntryDate((p) => (p ? p : iso));
    }

    setLoading(false);
  }, [api, mode, recordId]);

  useEffect(() => {
    load();
  }, [load]);

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow photo library permission to attach an entry photo.");
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
      Alert.alert("Check form", err);
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
          Alert.alert("Saved, but photo failed", up.error || "Could not upload photo");
        }
      }

      Alert.alert("Saved", "Record saved successfully.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Save failed", e?.message || "Unknown error");
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
      Alert.alert("Failed", e?.message || "Could not create option");
    } finally {
      setOptionBusy(false);
    }
  }

  async function deleteOptionRow(row) {
    if (!api || !optionModal?.key) return;
    if (!row?.id) return;
    const label = row.value || row.name || "";
    Alert.alert("Delete option", `Delete "${label}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setOptionBusy(true);
          try {
            const res = await api.records.deleteOption(row.id);
            if (!res.ok) throw new Error(res.error || "Could not delete option");
            const list = await api.records.listOptions({ category: optionModal.key });
            if (list.ok && Array.isArray(list.data)) {
              setOptions((prev) => ({ ...prev, [optionModal.key]: list.data }));
            }
          } catch (e) {
            Alert.alert("Failed", e?.message || "Could not delete option");
          } finally {
            setOptionBusy(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{mode === "edit" ? "Edit record" : "New record"}</Text>

        <Text style={styles.label}>Vendor *</Text>
        <TouchableOpacity style={styles.select} onPress={() => setVendorModal(true)}>
          <Text style={styles.selectText} numberOfLines={1}>
            {vendorName || "Select vendor"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Product description</Text>
        <TextInput
          value={productDescription}
          onChangeText={setProductDescription}
          style={[styles.input, styles.multiline]}
          multiline
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Product type *</Text>
        <TouchableOpacity style={styles.select} onPress={() => openOptionPicker("product_type")}>
          <Text style={styles.selectText} numberOfLines={1}>
            {productType || "Select product type"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Unit *</Text>
        <TouchableOpacity style={styles.select} onPress={() => openOptionPicker("unit")}>
          <Text style={styles.selectText} numberOfLines={1}>
            {unit || "Select unit"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Packaging</Text>
        <TouchableOpacity style={styles.select} onPress={() => openOptionPicker("packaging")}>
          <Text style={styles.selectText} numberOfLines={1}>
            {packaging || "Select packaging"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Quantity *</Text>
        <TextInput
          value={quantity}
          onChangeText={setQuantity}
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="e.g. 1250.5"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Entry date (YYYY-MM-DD) *</Text>
        <TextInput
          value={entryDate}
          onChangeText={setEntryDate}
          style={styles.input}
          placeholder="2026-05-06"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
        <TextInput
          value={dueDate}
          onChangeText={setDueDate}
          style={styles.input}
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.advHead}>
          <Text style={styles.advTitle}>More details (optional)</Text>
        </View>

        <Text style={styles.label}>Driver name</Text>
        <TouchableOpacity style={styles.select} onPress={() => openOptionPicker("driver_name")}>
          <Text style={styles.selectText} numberOfLines={1}>
            {driverName || "Select driver"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.label}>Vehicle details</Text>
        <TextInput
          value={vehicleDetails}
          onChangeText={setVehicleDetails}
          style={styles.input}
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
        />

        <Text style={styles.label}>Entry photo</Text>
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

        <Text style={styles.label}>Remarks</Text>
        <TextInput
          value={remarks}
          onChangeText={setRemarks}
          style={[styles.input, styles.multiline]}
          multiline
          placeholder="Optional"
          placeholderTextColor="#94a3b8"
        />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primary, busy && styles.disabled]}
            onPress={() => void submit()}
            disabled={busy}
          >
            <Text style={styles.primaryText}>{busy ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghost} onPress={() => navigation.goBack()}>
            <Text style={styles.ghostText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={vendorModal} animationType="slide">
        <SafeAreaView style={styles.modalSafe} edges={["bottom"]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Select vendor</Text>
            <TouchableOpacity onPress={() => setVendorModal(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
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
          <ScrollView contentContainerStyle={styles.modalList}>
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
        </SafeAreaView>
      </Modal>

      <Modal visible={Boolean(optionModal)} animationType="slide">
        <SafeAreaView style={styles.modalSafe} edges={["bottom"]}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Select</Text>
            <TouchableOpacity onPress={() => setOptionModal(null)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
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
          <ScrollView contentContainerStyle={styles.modalList}>
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
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { padding: 16, paddingBottom: 40, gap: 8 },
  title: { fontSize: 20, fontWeight: "900", color: "#0f172a", marginBottom: 6 },
  label: { marginTop: 8, fontSize: 13, fontWeight: "800", color: "#334155" },
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
  selectText: { color: "#0f172a", fontSize: 16, fontWeight: "700" },
  advHead: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0" },
  advTitle: { fontSize: 14, fontWeight: "900", color: "#0f172a" },
  photoBtn: {
    marginTop: 6,
    backgroundColor: "#dcfce7",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  photoBtnText: { color: "#166534", fontWeight: "900" },
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
  modalClose: { color: "#15803d", fontWeight: "900" },
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

