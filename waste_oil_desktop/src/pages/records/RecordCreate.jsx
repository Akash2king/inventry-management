import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { useRecordStore } from "@/store/recordStore.js";
import { RecordForm } from "@/components/records/RecordForm.jsx";
import { showToast } from "@/components/ui/ToastContainer.jsx";
import * as vendorsApi from "@/api/vendors.js";

function getToken() {
  return useAuthStore.getState().accessToken;
}

export function RecordCreate() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const createRecord = useRecordStore((s) => s.createRecord);
  const [busy, setBusy] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);

  useEffect(() => {
    vendorsApi
      .list(getToken())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.results ?? [];
        setVendors(list);
      })
      .catch(() => {
        setVendors([]);
        showToast("Could not load vendors", "error");
      })
      .finally(() => setVendorsLoading(false));
  }, []);

  if (user?.role !== "storeman") {
    navigate("/", { replace: true });
    return null;
  }

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
      const created = await createRecord(payload);
      showToast("Record created", "success");
      navigate(`/records/${created.id}`);
    } catch (e) {
      showToast(e.message || "Create failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 style={{ color: "var(--clr-text-bright)", marginTop: 0 }}>New Record</h2>
      {vendorsLoading ? (
        <div className="fullscreen-center" style={{ minHeight: 120 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 720 }}>
          <RecordForm
            vendors={vendors}
            onSubmit={onSubmit}
            onCancel={() => navigate(-1)}
            submitLabel="Create"
            isSubmitting={busy}
          />
        </div>
      )}
    </div>
  );
}
