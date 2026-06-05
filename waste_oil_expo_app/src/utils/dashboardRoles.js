/** Roles that see a compact “peer” dashboard (no org analytics / charts / completed block). */
export function isPeerDashboardRole(role) {
  return role === "storeman" || role === "treatment" || role === "admin";
}
