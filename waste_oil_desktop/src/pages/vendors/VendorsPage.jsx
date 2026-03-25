import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/authStore.js";
import * as vendorsApi from "@/api/vendors.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";

function getToken() {
  return useAuthStore.getState().accessToken;
}

export function VendorsPage() {
  const user = useAuthStore((s) => s.user);
  const canManage = ["storeman", "gm", "superadmin"].includes(user?.role || "");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

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
          contact: contact.trim(),
          address: address.trim(),
          notes: notes.trim(),
        },
        getToken()
      );
      showToast("Vendor added", "success");
      setName("");
      setContact("");
      setAddress("");
      setNotes("");
      await load();
    } catch (err) {
      showToast(err.message || "Save failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 style={{ color: "var(--clr-text-bright)", marginTop: 0 }}>Vendors</h2>
      <p style={{ opacity: 0.9, maxWidth: 640, lineHeight: 1.5 }}>
        Maintain vendor master data here, then choose a vendor when you create a new record.
      </p>

      {canManage ? (
        <div className="card" style={{ marginTop: "1rem", maxWidth: 560 }}>
          <h3 style={{ marginTop: 0, color: "var(--clr-text-bright)" }}>Add vendor</h3>
          <form onSubmit={onAdd} className="grid-form">
            <div className="field">
              <label htmlFor="v-name">Name</label>
              <input id="v-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="v-contact">Contact</label>
              <input id="v-contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone / email" />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label htmlFor="v-address">Address</label>
              <textarea id="v-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} />
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

      <div className="table-wrap" style={{ marginTop: "1.5rem" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Address</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "2rem" }}>
                  <div className="spinner" style={{ margin: "0 auto" }} />
                </td>
              </tr>
            ) : null}
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "2rem" }}>
                  No vendors yet.
                </td>
              </tr>
            ) : null}
            {!loading &&
              rows.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontWeight: 600 }}>{v.name}</td>
                  <td>{v.contact || "—"}</td>
                  <td style={{ maxWidth: 220, fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                    {v.address || "—"}
                  </td>
                  <td style={{ maxWidth: 200, fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>
                    {v.notes || "—"}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
