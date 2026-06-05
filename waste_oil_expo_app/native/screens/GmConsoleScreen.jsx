import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useAuth } from "../AuthContext.jsx";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { fromByteArray } from "base64-js";
import { theme } from "../theme.js";
import { KeyboardAwareScroll } from "../components/ui/KeyboardAwareScroll.jsx";
import { useScrollContentStyle } from "../utils/responsive.js";
import { useResponsiveType } from "../utils/typography.js";
import { showSuccess, showError, showConfirm } from "../utils/feedback.js";

const ROLE_OPTIONS = [
  { value: "storeman", label: "Storeman", layer: "peer" },
  { value: "treatment", label: "Treatment", layer: "peer" },
  { value: "admin", label: "Admin", layer: "peer" },
  { value: "manager", label: "Manager", layer: "oversight" },
];

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function uint8ToBase64(uint8) {
  try {
    return fromByteArray(uint8);
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

export function GmConsoleScreen({ navigation }) {
  const { api, user } = useAuth();
  const scrollStyle = useScrollContentStyle({ gap: 12 });
  const canView = user && (user.role === "gm" || user.role === "superadmin");

  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [deptFilter, setDeptFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");

  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");

  const [deptModal, setDeptModal] = useState(null);
  const [empModal, setEmpModal] = useState(null);

  const loadAll = useCallback(
    async (mode) => {
      if (!api || !canView) return;
      if (mode === "refresh") setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const [deps, emps] = await Promise.all([
          api.gm.getDepartments(),
          api.gm.getEmployees({
            department_id: deptFilter || undefined,
            role: roleFilter || undefined,
            search: search.trim() || undefined,
          }),
        ]);
        if (!deps.ok) throw new Error(deps.error || "Failed to load departments");
        if (!emps.ok) throw new Error(emps.error || "Failed to load employees");
        setDepartments(asList(deps.data));
        setEmployees(asList(emps.data));
      } catch (e) {
        setDepartments([]);
        setEmployees([]);
        setError(e?.message || "Failed to load GM console");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [api, canView, deptFilter, roleFilter, search],
  );

  useFocusEffect(
    useCallback(() => {
      loadAll("init").catch(() => {});
    }, [loadAll]),
  );

  const deptsByLayer = useMemo(() => {
    const m = new Map();
    departments.forEach((d) => {
      const layer = d.workflow_layer || "peer";
      const arr = m.get(layer) || [];
      arr.push(d);
      m.set(layer, arr);
    });
    return m;
  }, [departments]);

  async function downloadPdf() {
    if (!api) return;
    try {
      const res = await api.gm.getMonthlyReportPdf({ from: reportFrom || undefined, to: reportTo || undefined });
      if (!res.ok) throw new Error(res.error || "PDF download failed");
      const bytes = res.data;
      const base64 = uint8ToBase64(bytes);
      if (!base64) throw new Error("Could not encode PDF bytes");
      const name = `monthly_inventory_${reportFrom || "from"}_${reportTo || "to"}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const dir = await ensureDocsDir();
      const uri = `${dir}${name}`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: "base64" });
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error("File write failed");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share monthly report" });
      }
      showSuccess("Saved to Documents");
    } catch (e) {
      showError(e?.message || "PDF download failed");
    }
  }

  async function downloadExcel() {
    if (!api) return;
    try {
      const res = await api.gm.getMonthlyReport({ from: reportFrom || undefined, to: reportTo || undefined });
      if (!res.ok) throw new Error(res.error || "Excel export failed");
      const report = res.data || {};
      const period = report?.period || {};
      const k = report?.kpis || {};
      const alerts = k.alerts || {};

      const sheets = [];
      sheets.push({
        name: "Monthly Inventory",
        rows: [
          ["Metric", "Value"],
          ["Report title", report?.report_title || "Monthly Inventory Report"],
          ["Period from", period.from || ""],
          ["Period to", period.to || ""],
          ["Total records", k.total_records ?? 0],
          ["Completed", k.completed ?? 0],
          ["Completion rate (%)", k.completion_rate ?? 0],
          ["Active", k.active_records ?? 0],
          ["Alerts – Green", alerts.green ?? 0],
          ["Alerts – Yellow", alerts.yellow ?? 0],
          ["Alerts – Orange", alerts.orange ?? 0],
          ["Alerts – Red", alerts.red ?? 0],
          ["Records with photos", k.records_with_photos ?? 0],
        ],
      });

      const byStage = Array.isArray(report.records_by_stage) ? report.records_by_stage : [];
      sheets.push({
        name: "Stages",
        rows: [["Stage", "Count"], ...byStage.map((r) => [r.current_stage, r.count])],
      });

      const workload = Array.isArray(report.department_workload) ? report.department_workload : [];
      sheets.push({
        name: "Departments",
        rows: [
          ["Department", "Active", "Completed"],
          ...workload.map((r) => [r.current_department__name || "Unassigned", r.active ?? 0, r.completed_count ?? 0]),
        ],
      });

      const vendors = Array.isArray(report.vendors) ? report.vendors : [];
      sheets.push({
        name: "Vendors",
        rows: [["Vendor", "Total records", "Red alerts"], ...vendors.map((v) => [v.vendor__name || "", v.total_records ?? 0, v.red_count ?? 0])],
      });

      const wb = XLSX.utils.book_new();
      sheets.forEach((s) => {
        const ws = XLSX.utils.aoa_to_sheet(s.rows);
        XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
      });
      const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });
      const name = `monthly_inventory_${period.from || reportFrom || "from"}_${period.to || reportTo || "to"}.xlsx`.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const dir = await ensureDocsDir();
      const uri = `${dir}${name}`;
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: "base64" });
      const info = await FileSystem.getInfoAsync(uri);
      if (!info.exists) throw new Error("File write failed");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Share monthly report",
        });
      }
      showSuccess("Saved to Documents");
    } catch (e) {
      showError(e?.message || "Excel export failed");
    }
  }

  if (!canView) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.wrap}>
          <Text style={styles.title}>GM console</Text>
          <Text style={styles.help}>Only GM / Superadmin can access this screen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <KeyboardAwareScroll
        contentContainerStyle={scrollStyle}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadAll("refresh")} />}
      >
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>GM console</Text>
            <Text style={styles.help}>{user?.full_name || user?.username}</Text>
          </View>
          <TouchableOpacity style={styles.btnGhost} onPress={() => void loadAll("refresh")}>
            <Text style={styles.btnGhostText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {[
            { id: "overview", label: "Overview & reports" },
            { id: "departments", label: "Departments" },
            { id: "users", label: "Users" },
          ].map((t) => {
            const on = tab === t.id;
            return (
              <TouchableOpacity key={t.id} style={[styles.tab, on && styles.tabOn]} onPress={() => setTab(t.id)}>
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {error ? (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {loading ? (
          <View style={{ paddingVertical: 40 }}>
            <ActivityIndicator size="large" />
          </View>
        ) : null}

        {tab === "overview" && !loading ? (
          <View style={styles.card}>
            <Text style={styles.sub}>Monthly Inventory Reports</Text>
            <Text style={styles.hint}>
              This is the same server report as the monthly email. Choose a date range (optional) and download.
            </Text>
            <TouchableOpacity
              style={styles.btnGhost}
              onPress={() => navigation.navigate("Home", { screen: "RecordsTab" })}
            >
              <Text style={styles.btnGhostText}>Open all records</Text>
            </TouchableOpacity>
            <Text style={styles.label}>From (YYYY-MM-DD)</Text>
            <TextInput value={reportFrom} onChangeText={setReportFrom} style={styles.input} placeholder="2026-01-01" placeholderTextColor="#94a3b8" />
            <Text style={styles.label}>To (YYYY-MM-DD)</Text>
            <TextInput value={reportTo} onChangeText={setReportTo} style={styles.input} placeholder="2026-01-31" placeholderTextColor="#94a3b8" />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={styles.btnGhost}
                onPress={() => {
                  setReportFrom("");
                  setReportTo("");
                }}
              >
                <Text style={styles.btnGhostText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnGhost} onPress={() => void downloadExcel()}>
                <Text style={styles.btnGhostText}>Download Excel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => void downloadPdf()}>
                <Text style={styles.btnPrimaryText}>Download PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {tab === "departments" && !loading ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.sub}>Departments</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => setDeptModal({ mode: "create" })}>
                <Text style={styles.btnPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>
            {departments.length === 0 ? <Text style={styles.hint}>No departments.</Text> : null}
            {departments.map((d) => (
              <TouchableOpacity key={String(d.id)} style={styles.row} onPress={() => setDeptModal({ mode: "edit", row: d })}>
                <Text style={styles.rowTitle}>{d.name}</Text>
                <Text style={styles.rowSub}>
                  {(d.code || "—") + ` • ${(d.workflow_layer || "peer")} • order ${d.stage_order}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {tab === "users" && !loading ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.sub}>Users</Text>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => setEmpModal({ mode: "create", deptsByLayer })}>
                <Text style={styles.btnPrimaryText}>Add</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Department id (optional)</Text>
            <TextInput value={deptFilter} onChangeText={setDeptFilter} style={styles.input} placeholder="e.g. 1" placeholderTextColor="#94a3b8" />
            <Text style={styles.label}>Role filter (optional)</Text>
            <TextInput value={roleFilter} onChangeText={setRoleFilter} style={styles.input} placeholder="storeman / admin / manager…" placeholderTextColor="#94a3b8" />
            <Text style={styles.label}>Search</Text>
            <TextInput value={search} onChangeText={setSearch} style={styles.input} placeholder="Username/email/name…" placeholderTextColor="#94a3b8" />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={styles.btnGhost} onPress={() => void loadAll("refresh")}>
                <Text style={styles.btnGhostText}>Apply</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnGhost}
                onPress={() => {
                  setDeptFilter("");
                  setRoleFilter("");
                  setSearch("");
                }}
              >
                <Text style={styles.btnGhostText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {employees.length === 0 ? <Text style={styles.hint}>No users match this filter.</Text> : null}
            {employees.map((e) => (
              <TouchableOpacity key={String(e.id)} style={styles.row} onPress={() => setEmpModal({ mode: "edit", row: e, deptsByLayer })}>
                <Text style={styles.rowTitle}>{e.full_name || e.username}</Text>
                <Text style={styles.rowSub}>
                  {`@${e.username} • ${(e.role || "").toString()} • ${e.department_name || "—"} • ${e.is_active ? "Active" : "Disabled"}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {deptModal ? (
          <DepartmentModal
            modal={deptModal}
            onClose={() => setDeptModal(null)}
            onSaved={() => {
              setDeptModal(null);
              loadAll("refresh").catch(() => {});
            }}
            api={api}
          />
        ) : null}

        {empModal ? (
          <EmployeeModal
            modal={empModal}
            onClose={() => setEmpModal(null)}
            onSaved={() => {
              setEmpModal(null);
              loadAll("refresh").catch(() => {});
            }}
            api={api}
            departments={departments}
          />
        ) : null}
      </KeyboardAwareScroll>
    </SafeAreaView>
  );
}

function DepartmentModal({ modal, onClose, onSaved, api }) {
  const mode = modal?.mode;
  const row = modal?.row;
  const [name, setName] = useState(mode === "edit" ? row?.name ?? "" : "");
  const [code, setCode] = useState(mode === "edit" ? row?.code ?? "" : "");
  const [workflowLayer, setWorkflowLayer] = useState(mode === "edit" ? row?.workflow_layer ?? "peer" : "peer");
  const [order, setOrder] = useState(String(mode === "edit" ? row?.stage_order ?? 1 : 1));
  const [busy, setBusy] = useState(false);

  async function submit() {
    const st = Number(order);
    if (!name.trim() || !code.trim()) {
      showError("Name and code are required.");
      return;
    }
    if (!Number.isFinite(st) || st < 1) {
      showError("Stage order must be at least 1.");
      return;
    }
    setBusy(true);
    try {
      const payload = { name: name.trim(), code: code.trim().toUpperCase(), workflow_layer: workflowLayer, stage_order: st };
      const res =
        mode === "create"
          ? await api.gm.createDepartment(payload)
          : await api.gm.updateDepartment(row.id, payload);
      if (!res.ok) throw new Error(res.error || "Save failed");
      onSaved();
    } catch (e) {
      showError(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (mode !== "edit") return;
    showConfirm({
      title: "Delete department",
      message: `Delete "${row?.name}"?`,
      confirmText: "Delete",
      destructive: true,
      icon: "trash-outline",
      onConfirm: async () => {
        try {
          const res = await api.gm.deleteDepartment(row.id);
          if (!res.ok) throw new Error(res.error || "Delete failed");
          onSaved();
        } catch (e) {
          showError(e?.message || "Delete failed");
        }
      },
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{mode === "create" ? "New department" : "Edit department"}</Text>
          <Text style={styles.label}>Name</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="Department name" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Code</Text>
          <TextInput value={code} onChangeText={setCode} style={styles.input} placeholder="CODE" placeholderTextColor="#94a3b8" autoCapitalize="characters" />
          <Text style={styles.label}>Layer (peer / oversight)</Text>
          <TextInput value={workflowLayer} onChangeText={setWorkflowLayer} style={styles.input} placeholder="peer" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Order</Text>
          <TextInput value={order} onChangeText={setOrder} style={styles.input} placeholder="1" placeholderTextColor="#94a3b8" keyboardType="numeric" />
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose} disabled={busy}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            {mode === "edit" ? (
              <TouchableOpacity style={[styles.btnGhost, { borderColor: "rgba(239,68,68,0.35)" }]} onPress={() => void remove()} disabled={busy}>
                <Text style={[styles.btnGhostText, { color: "#b91c1c" }]}>Delete</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={() => void submit()} disabled={busy}>
              <Text style={styles.btnPrimaryText}>{busy ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EmployeeModal({ modal, onClose, onSaved, api, departments }) {
  const mode = modal?.mode;
  const row = modal?.row;

  const [username, setUsername] = useState(mode === "edit" ? row?.username ?? "" : "");
  const [email, setEmail] = useState(mode === "edit" ? row?.email ?? "" : "");
  const [fullName, setFullName] = useState(mode === "edit" ? row?.full_name ?? "" : "");
  const [role, setRole] = useState(mode === "edit" ? row?.role ?? "storeman" : "storeman");
  const [deptId, setDeptId] = useState(mode === "edit" ? String(row?.department ?? row?.department_id ?? "") : "");
  const [password, setPassword] = useState("");
  const [isActive, setIsActive] = useState(mode === "edit" ? row?.is_active !== false : true);
  const [busy, setBusy] = useState(false);

  const roleLayer = ROLE_OPTIONS.find((x) => x.value === role)?.layer || "peer";
  const suggestedDeptId = useMemo(() => {
    const m = modal?.deptsByLayer;
    if (!m || !(m instanceof Map)) return "";
    const rows = m.get(roleLayer) || [];
    const d = rows[0];
    return d ? String(d.id) : "";
  }, [modal?.deptsByLayer, roleLayer]);

  async function submit() {
    if (!email.trim()) {
      showError("Email is required.");
      return;
    }
    if (mode === "create" && (!password || password.length < 8)) {
      showError("Password must be at least 8 characters.");
      return;
    }
    const department = deptId || suggestedDeptId;
    if (!department) {
      showError("No department available. Create departments first.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "create") {
        const res = await api.gm.createEmployee({
          username: username.trim(),
          email: email.trim(),
          full_name: fullName.trim(),
          role,
          department,
          password,
          is_active: isActive,
        });
        if (!res.ok) throw new Error(res.error || "Create failed");
      } else {
        const payload = {
          email: email.trim(),
          full_name: fullName.trim(),
          role,
          department,
          is_active: isActive,
        };
        if (password && password.length >= 8) payload.password = password;
        const res = await api.gm.updateEmployee(row.id, payload);
        if (!res.ok) throw new Error(res.error || "Update failed");
      }
      onSaved();
    } catch (e) {
      showError(e?.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (mode !== "edit") return;
    showConfirm({
      title: "Remove user",
      message: `Remove "${row?.username}"?`,
      confirmText: "Remove",
      destructive: true,
      icon: "person-remove-outline",
      onConfirm: async () => {
        try {
          const res = await api.gm.deleteEmployee(row.id);
          if (!res.ok) throw new Error(res.error || "Remove failed");
          onSaved();
        } catch (e) {
          showError(e?.message || "Remove failed");
        }
      },
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{mode === "create" ? "New user" : "Edit user"}</Text>

          {mode === "create" ? (
            <>
              <Text style={styles.label}>Username</Text>
              <TextInput value={username} onChangeText={setUsername} style={styles.input} placeholder="username" placeholderTextColor="#94a3b8" autoCapitalize="none" />
            </>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} style={styles.input} placeholder="email" placeholderTextColor="#94a3b8" autoCapitalize="none" />
          <Text style={styles.label}>Full name</Text>
          <TextInput value={fullName} onChangeText={setFullName} style={styles.input} placeholder="Full name" placeholderTextColor="#94a3b8" />
          <Text style={styles.label}>Role</Text>
          <TextInput value={role} onChangeText={setRole} style={styles.input} placeholder="storeman/admin/manager…" placeholderTextColor="#94a3b8" autoCapitalize="none" />
          <Text style={styles.label}>Department id (auto if blank)</Text>
          <TextInput value={deptId} onChangeText={setDeptId} style={styles.input} placeholder={suggestedDeptId ? `e.g. ${suggestedDeptId}` : "e.g. 1"} placeholderTextColor="#94a3b8" />
          <Text style={styles.hint}>
            Current dept name:{" "}
            {(deptId && departments.find((d) => String(d.id) === String(deptId))?.name) || "—"}
          </Text>
          <Text style={styles.label}>{mode === "create" ? "Password" : "New password (optional)"}</Text>
          <TextInput value={password} onChangeText={setPassword} style={styles.input} placeholder={mode === "create" ? "Min 8 characters" : "Leave blank to keep"} placeholderTextColor="#94a3b8" secureTextEntry />
          <TouchableOpacity style={styles.btnGhost} onPress={() => setIsActive((s) => !s)}>
            <Text style={styles.btnGhostText}>{isActive ? "Active: Yes (tap to disable)" : "Active: No (tap to enable)"}</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={styles.btnGhost} onPress={onClose} disabled={busy}>
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            {mode === "edit" ? (
              <TouchableOpacity style={[styles.btnGhost, { borderColor: "rgba(239,68,68,0.35)" }]} onPress={() => void remove()} disabled={busy}>
                <Text style={[styles.btnGhostText, { color: "#b91c1c" }]}>Remove</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.btnPrimary, { flex: 1 }]} onPress={() => void submit()} disabled={busy}>
              <Text style={styles.btnPrimaryText}>{busy ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f1f5f9" },
  wrap: { flex: 1, padding: 16, gap: 10 },
  scroll: { padding: 16, paddingBottom: 28, gap: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  title: { fontSize: 20, fontWeight: "900", color: "#0f172a" },
  help: { fontSize: 13, color: "#64748b" },
  tabRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  tab: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#fff" },
  tabOn: { backgroundColor: "#0ea5e9", borderColor: "#0ea5e9" },
  tabText: { fontSize: 12, fontWeight: "900", color: "#0f172a" },
  tabTextOn: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#e2e8f0", padding: 14, gap: 8 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sub: { fontSize: 13, fontWeight: "900", color: "#0f172a", opacity: 0.85 },
  hint: { fontSize: 12, color: "#64748b", lineHeight: 18 },
  label: { marginTop: 6, fontSize: 12, fontWeight: "800", color: "#334155" },
  input: { marginTop: 6, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: "#0f172a", backgroundColor: "#fff" },
  row: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#e2e8f0", gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: "900", color: "#0f172a" },
  rowSub: { fontSize: 12, color: "#475569" },
  btnPrimary: { backgroundColor: "#15803d", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, alignItems: "center" },
  btnPrimaryText: { color: "#fff", fontWeight: "900" },
  btnGhost: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#cbd5e1", alignItems: "center" },
  btnGhostText: { color: "#334155", fontWeight: "900" },
  error: { padding: 12, borderRadius: 12, backgroundColor: "rgba(239,68,68,0.10)", borderWidth: 1, borderColor: "rgba(239,68,68,0.25)" },
  errorText: { color: "#b91c1c", fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.45)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    padding: theme.space.lg,
    gap: theme.space.xs,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#0f172a" },
});

