export const ROLE_STAGE = {
  storeman: 1,
  treatment: 2,
  admin: 3,
  manager: 4,
  gm: 5,
  superadmin: null,
};

export function stageForRole(role) {
  const v = ROLE_STAGE[role];
  return v === undefined ? null : v;
}

export function canForward(role, currentStage) {
  const rs = stageForRole(role);
  return rs != null && rs === currentStage;
}

export function canReturn(role, currentStage) {
  return canForward(role, currentStage) && currentStage > 1;
}

export function canEdit(role, currentStage) {
  return canForward(role, currentStage);
}

export function isCurrentHolder(record, user) {
  if (!record || !user) return false;
  const hid = record.current_holder_id;
  if (hid == null) return false;
  return String(hid) === String(user.id);
}

export function canActForward(record, user) {
  if (!record || record.is_locked) return false;
  return (
    canForward(user?.role, record.current_stage) &&
    isCurrentHolder(record, user)
  );
}

export function canActReturn(record, user) {
  if (!record || record.is_locked) return false;
  return (
    canReturn(user?.role, record.current_stage) &&
    isCurrentHolder(record, user)
  );
}

export function canActEdit(record, user) {
  if (!record || record.is_locked) return false;
  return (
    canEdit(user?.role, record.current_stage) &&
    isCurrentHolder(record, user)
  );
}
