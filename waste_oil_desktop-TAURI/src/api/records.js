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

export function uploadPhoto(id, file, token) {
  return unwrap(window.api.records.uploadPhoto(id, file, token));
}

/** Authenticated binary fetch for <img> (JWT cannot be sent to plain /media/ URLs). */
export function getEntryPhoto(id, token) {
  return window.api.records.getEntryPhoto(id, token);
}

export function listOptions(filters, token) {
  return unwrap(window.api.records.listOptions(filters, token));
}

export function createOption(data, token) {
  return unwrap(window.api.records.createOption(data, token));
}

export function deleteOption(id, token) {
  return unwrap(window.api.records.deleteOption(id, token));
}
