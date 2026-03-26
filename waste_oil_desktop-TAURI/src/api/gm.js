import { unwrap } from "./_unwrap.js";

function asList(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

export function getDepartments(token) {
  return unwrap(window.api.gm.getDepartments(token)).then(asList);
}

export function getEmployees(filters, token) {
  return unwrap(window.api.gm.getEmployees(filters, token)).then(asList);
}

export function createEmployee(data, token) {
  return unwrap(window.api.gm.createEmployee(data, token));
}

export function updateEmployee(id, data, token) {
  return unwrap(window.api.gm.updateEmployee(id, data, token));
}
