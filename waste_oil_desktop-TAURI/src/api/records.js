import { unwrap } from "./_unwrap.js";

export function getAll(filters, token) {
  return unwrap(window.api.records.getAll(filters, token));
}

export function getById(id, token) {
  return unwrap(window.api.records.getById(id, token));
}

export function create(data, token) {
  return unwrap(window.api.records.create(data, token));
}

export function update(id, data, token) {
  return unwrap(window.api.records.update(id, data, token));
}

export function uploadAttachment(id, file, token) {
  return unwrap(window.api.records.uploadAttachment(id, file, token));
}
