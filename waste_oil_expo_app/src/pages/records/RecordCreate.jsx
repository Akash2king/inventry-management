import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore.js";
import { useRecordStore } from "@/store/recordStore.js";
import { RecordForm } from "@/components/records/RecordForm.jsx";
import { showToast } from "@/components/ui/ToastContainer.jsx";
import * as vendorsApi from "@/api/vendors.js";
import * as recordsApi from "@/api/records.js";

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
  const [optionSets, setOptionSets] = useState({});

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

  useEffect(() => {
    const cats = ["product_type", "unit", "driver_name", "packaging"];
    Promise.all(cats.map((c) => recordsApi.listOptions({ category: c }, getToken())))
      .then((res) => {
        const next = {};
        cats.forEach((c, idx) => {
          next[c] = Array.isArray(res[idx]) ? res[idx] : res[idx]?.results || [];
        });
        setOptionSets(next);
      })
      .catch(() => setOptionSets({}));
  }, []);

  async function handleCreateOption(category, value) {
    try {
      const created = await recordsApi.createOption({ category, value }, getToken());
      setOptionSets((prev) => ({
        ...prev,
        [category]: [...(prev[category] || []), created].sort((a, b) => (a.value || "").localeCompare(b.value || "")),
      }));
      showToast("Option added", "success");
    } catch (e) {
      showToast(e.message || "Could not add option", "error");
    }
  }

  async function handleDeleteOption(category, option) {
    try {
      await recordsApi.deleteOption(option.id, getToken());
      setOptionSets((prev) => ({
        ...prev,
        [category]: (prev[category] || []).filter((x) => x.id !== option.id),
      }));
      showToast("Option deleted", "success");
    } catch (e) {
      showToast(e.message || "Could not delete option", "error");
    }
  }

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
        packaging: data.packaging || "",
        quantity: String(data.quantity),
        entry_date: data.entry_date,
        driver_name: data.driver_name || "",
        vehicle_details: data.vehicle_details || "",
        remarks: data.remarks || "",
      };
      if (data.due_date && String(data.due_date).trim()) {
        payload.due_date = data.due_date;
      }
      const created = await createRecord(payload);
      const photo = data.photo_file || null;
      if (photo) {
        await recordsApi.uploadPhoto(created.id, photo, getToken());
      }
      showToast("Record created", "success");
      navigate(`/records/${created.id}`);
    } catch (e) {
      showToast(e.message || "Create failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="record-edit-page">
      <h2 style={{ color: "var(--clr-text-bright)", marginTop: 0 }}>New Record</h2>
      {vendorsLoading ? (
        <div className="fullscreen-center" style={{ minHeight: 120 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 720 }}>
          <RecordForm
            vendors={vendors}
            optionSets={optionSets}
            optionManageEnabled={user?.role === "storeman" || user?.role === "gm" || user?.role === "superadmin"}
            onCreateOption={handleCreateOption}
            onDeleteOption={handleDeleteOption}
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
