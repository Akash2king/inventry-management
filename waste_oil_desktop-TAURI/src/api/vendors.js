import { unwrap } from "./_unwrap.js";

export function list(token) {
  return unwrap(window.api.vendors.list(token));
}

export function create(data, token) {
  return unwrap(window.api.vendors.create(data, token));
}

export function update(id, data, token) {
  return unwrap(window.api.vendors.update(id, data, token));
}
