/**
 * Navigate from notification metadata (same rules as mobile push deeplinks).
 * @param {object} metadata
 * @returns {{ path: string, state?: object } | null}
 */
export function notificationTargetFromMetadata(metadata) {
  const meta = metadata && typeof metadata === "object" ? metadata : {};
  const kind = String(meta.kind || "").toLowerCase();
  const recordId = meta.record_id || meta.recordId;

  if (recordId) {
    const title = meta.record_number || meta.recordNumber || "Record";
    return { path: `/records/${recordId}`, state: { title } };
  }
  if (kind === "monthly_report") {
    return { path: "/gm" };
  }
  return { path: "/notifications" };
}

/** @param {import('react-router-dom').NavigateFunction} navigate */
export function navigateFromNotificationMetadata(navigate, metadata) {
  const target = notificationTargetFromMetadata(metadata);
  if (!target) return;
  navigate(target.path, target.state ? { state: target.state } : undefined);
}
