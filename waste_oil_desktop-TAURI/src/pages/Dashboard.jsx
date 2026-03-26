import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRecordStore } from "@/store/recordStore.js";
import { useWorkflowStore } from "@/store/workflowStore.js";

export function Dashboard() {
  const navigate = useNavigate();
  const fetchAll = useRecordStore((s) => s.fetchAll);
  const records = useRecordStore((s) => s.records);
  const pagination = useRecordStore((s) => s.pagination);
  const fetchQueue = useWorkflowStore((s) => s.fetchQueue);
  const queue = useWorkflowStore((s) => s.queue);

  useEffect(() => {
    fetchAll({ page_size: 5 }).catch(() => {});
    fetchQueue().catch(() => {});
  }, [fetchAll, fetchQueue]);

  const total = pagination.count || 0;
  const queueCount = queue.length;
  const activeApprox = records.filter((r) => r.alert_level !== "completed").length;

  return (
    <div>
      <h2 style={{ color: "var(--clr-text-bright)", marginTop: 0 }}>Dashboard</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
        }}
      >
        <div className="card">
          <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>Total Records</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 8 }}>{total}</div>
        </div>
        <button
          type="button"
          className="card"
          onClick={() => navigate("/queue")}
          style={{
            textAlign: "left",
            cursor: "pointer",
            border: "1px solid var(--clr-border)",
            background: "var(--clr-surface)",
          }}
        >
          <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>My Queue</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 8 }}>
            {queueCount}
          </div>
          <div style={{ fontSize: "0.8rem", marginTop: 6, color: "#6ec8ff" }}>Open queue</div>
        </button>
        <div className="card">
          <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>Active (sample)</div>
          <div style={{ fontSize: "1.75rem", fontWeight: 700, marginTop: 8 }}>{activeApprox}</div>
          <div style={{ fontSize: "0.75rem", marginTop: 6, opacity: 0.75 }}>Latest page max 5</div>
        </div>
      </div>
    </div>
  );
}
