import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore.js";
import * as vendorsApi from "@/api/vendors.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";
import { downloadExcelFile } from "@/utils/excelExport.js";

function getToken() {
  return useAuthStore.getState().accessToken;
}

export function VendorsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = ["storeman", "gm", "superadmin"].includes(user?.role || "");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await vendorsApi.list(getToken());
      setRows(Array.isArray(data) ? data : data?.results || []);
    } catch (e) {
      showToast(e.message || "Could not load vendors", "error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  function openEdit(v) {
    setEditing(v);
    setEditName(v.name || "");
    setEditNotes(v.notes || "");
  }

  function closeEdit() {
    setEditing(null);
  }

  async function onAdd(e) {
    e.preventDefault();
    if (!name.trim()) {
      showToast("Vendor name is required", "error");
      return;
    }
    setBusy(true);
    try {
      await vendorsApi.create(
        {
          name: name.trim(),
          notes: notes.trim(),
        },
        getToken(),
      );
      showToast("Vendor added", "success");
      setName("");
      setNotes("");
      await load();
    } catch (err) {
      showToast(err.message || "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEdit(e) {
    e.preventDefault();
    if (!editing) return;
    if (!editName.trim()) {
      showToast("Vendor name is required", "error");
      return;
    }
    setEditBusy(true);
    try {
      await vendorsApi.update(
        editing.id,
        {
          name: editName.trim(),
          notes: editNotes.trim(),
        },
        getToken(),
      );
      showToast("Vendor updated", "success");
      closeEdit();
      await load();
    } catch (err) {
      showToast(err.message || "Update failed", "error");
    } finally {
      setEditBusy(false);
    }
  }

  async function exportVendorsExcel() {
    if (rows.length === 0) {
      showToast("No vendors to export.", "error");
      return;
    }
    try {
      const dataRows = rows.map((v) => [v.name || "", v.notes || ""]);
      const stamp = new Date().toISOString().slice(0, 10);
      const saved = await downloadExcelFile(`vendors_export_${stamp}.xlsx`, "Vendors", ["name", "notes"], dataRows);
      if (saved) showToast(`Exported ${rows.length} vendor(s).`, "success");
    } catch (e) {
      showToast(e?.message || "Export failed", "error");
    }
  }

  async function onDelete(v) {
    if (
      !window.confirm(
        `Delete vendor "${v.name}"? This cannot be undone if no records reference this vendor.`,
      )
    ) {
      return;
    }
    try {
      await vendorsApi.remove(v.id, getToken());
      showToast("Vendor deleted", "success");
      await load();
    } catch (err) {
      showToast(err.message || "Delete failed", "error");
    }
  }

  return (
    <div className="page-vendors">
      <div className="page-vendors__intro">
        <h2 className="page-vendors__title">Vendors</h2>
        <p className="page-vendors__lede">
          Maintain vendor master data here, then choose a vendor when you create a new record.
        </p>
      </div>

      {canManage ? (
        <div className="card card--accent-top" style={{ marginTop: "1rem", maxWidth: 640 }}>
          <h3 className="card__subtitle">Add vendor</h3>
          <form onSubmit={onAdd} className="grid-form">
            <div className="field">
              <label htmlFor="v-name">Name</label>
              <input id="v-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="v-notes">Notes</label>
              <textarea id="v-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="btn btn-primary" disabled={busy}>
                {busy ? "Saving…" : "Save vendor"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <p className="record-readonly-hint" style={{ marginTop: "1rem" }}>
          Only storeman, GM, or superadmin can add or edit vendors. You can still view the list.
        </p>
      )}

      <div
        style={{
          marginTop: "1.5rem",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <h3 className="card__subtitle" style={{ margin: 0 }}>
          Vendor list
        </h3>
        <button type="button" className="btn btn-ghost" disabled={loading || rows.length === 0} onClick={() => void exportVendorsExcel()}>
          Export Excel
        </button>
      </div>

      <div className="table-wrap table-wrap--raised" style={{ marginTop: "0.75rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Notes</th>
              {canManage ? <th className="th-actions">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={canManage ? 3 : 2} style={{ textAlign: "center", padding: "2rem" }}>
                  <div className="spinner" style={{ margin: "0 auto" }} />
                </td>
              </tr>
            ) : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 3 : 2} style={{ textAlign: "center", padding: "2rem" }}>
                  No vendors yet.
                </td>
              </tr>
            ) : null}
            {!loading &&
              rows.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td style={{ maxWidth: 200, fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                    {v.notes || "—"}
                  </td>
                  {canManage ? (
                    <td className="td-actions" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(v)}>
                        Delete
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-list">
        {loading ? (
          <div className="card mobile-list__state">
            <div className="spinner" style={{ margin: "0 auto" }} />
          </div>
        ) : null}
        {!loading && rows.length === 0 ? <div className="card mobile-list__state">No vendors yet.</div> : null}
        {!loading &&
          rows.map((v) => (
            <div key={v.id} className="card mobile-vendor-card">
              <div className="mobile-vendor-card__head">
                <strong>{v.name}</strong>
              </div>
              <div className="mobile-vendor-card__notes">{v.notes || "—"}</div>
              {canManage ? (
                <div className="mobile-vendor-card__actions">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(v)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => onDelete(v)}>
                    Delete
                  </button>
                </div>
              ) : null}
            </div>
          ))}
      </div>

      {editing ? (
        <div className="modal-backdrop" role="presentation" onClick={closeEdit}>
          <div
            className="modal modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-vendor-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="edit-vendor-title" style={{ marginTop: 0 }}>
              Edit vendor
            </h3>
            <form onSubmit={onSaveEdit} className="grid-form">
              <div className="field">
                <label htmlFor="ev-name">Name</label>
                <input id="ev-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="ev-notes">Notes</label>
                <textarea id="ev-notes" rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button type="submit" className="btn btn-primary" disabled={editBusy}>
                  {editBusy ? "Saving…" : "Save changes"}
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeEdit}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
