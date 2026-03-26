import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRecordStore } from "@/store/recordStore.js";
import { useAuthStore } from "@/store/authStore.js";
import { RecordForm } from "@/components/records/RecordForm.jsx";
import { canActEdit } from "@/utils/permissions.js";
import { formatHolderLine } from "@/utils/holderDisplay.js";
import { showToast } from "@/components/ui/ToastContainer.jsx";
import * as vendorsApi from "@/api/vendors.js";

function getToken() {
  return useAuthStore.getState().accessToken;
}

export function RecordEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const fetchOne = useRecordStore((s) => s.fetchOne);
  const updateRecord = useRecordStore((s) => s.updateRecord);
  const activeRecord = useRecordStore((s) => s.activeRecord);
  const [busy, setBusy] = useState(false);
  const [vendors, setVendors] = useState([]);

  useEffect(() => {
    if (id) fetchOne(id).catch(() => {});
  }, [id, fetchOne]);

  useEffect(() => {
    vendorsApi
      .list(getToken())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.results ?? [];
        setVendors(list);
      })
      .catch(() => setVendors([]));
  }, []);

  const r = activeRecord;
  if (!r || String(r.id) !== String(id)) {
    return (
      <div className="fullscreen-center">
        <div className="spinner" />
      </div>
    );
  }

  const canEdit = canActEdit(r, user);

  async function onSubmit(data) {
    setBusy(true);
    try {
      const payload = {
        vendor_id: data.vendor_id,
        product_description: data.product_description || "",
        product_type: data.product_type,
        unit: data.unit,
        quantity: String(data.quantity),
        entry_date: data.entry_date,
        remarks: data.remarks || "",
      };
      if (data.due_date && String(data.due_date).trim()) {
        payload.due_date = data.due_date;
      }
      await updateRecord(id, payload);
      showToast("Record updated", "success");
      navigate(`/records/${id}`);
    } catch (e) {
      showToast(e.message || "Update failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const defaults = {
    vendor_id: r.vendor_id ? String(r.vendor_id) : "",
    product_description: r.product_description || "",
    product_type: r.product_type || "",
    unit: r.unit || "",
    quantity: r.quantity,
    entry_date: r.entry_date || "",
    due_date: r.due_date || "",
    remarks: r.remarks || "",
  };

  const returnFb =
    typeof r.pending_return_feedback === "string" && r.pending_return_feedback.trim()
      ? r.pending_return_feedback.trim()
      : null;

  return (
    <div>
      <h2 style={{ color: "var(--clr-text-bright)", marginTop: 0 }}>Edit {r.record_number}</h2>
      {canEdit && r.needs_workflow_correction && !r.is_locked ? (
        <div className="record-return-banner record-return-banner-holder" role="status" style={{ marginBottom: "1rem" }}>
          <strong>Returned for corrections</strong>
          {returnFb ? <div className="record-return-feedback">{returnFb}</div> : null}
          <p className="record-return-cta" style={{ marginBottom: 0 }}>
            Save your updates, then forward the record again from the detail page when it is ready.
          </p>
        </div>
      ) : null}
      {!canEdit ? (
        <div className="record-readonly-hint" style={{ marginBottom: "1rem" }}>
          Only the current holder <strong>{formatHolderLine(r)}</strong> (stage{" "}
          <strong>{r.current_stage}</strong>) can edit this record. You can still view details from the record
          page.
        </div>
      ) : null}
      <fieldset
        disabled={!canEdit}
        style={{ border: "none", padding: 0, margin: 0 }}
      >
        <div className="card" style={{ maxWidth: 720 }}>
          <RecordForm
            key={r.updated_at || r.id}
            vendors={vendors}
            defaultValues={defaults}
            onSubmit={onSubmit}
            onCancel={() => navigate(`/records/${id}`)}
            submitLabel="Save"
            isSubmitting={busy}
          />
        </div>
      </fieldset>
    </div>
  );
}
