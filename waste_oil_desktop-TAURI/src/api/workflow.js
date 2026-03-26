import { unwrap } from "./_unwrap.js";

/** @param {{ note?: string, next_holder_id?: string }} [options] */
export function forward(id, options, token) {
  const payload =
    typeof options === "string"
      ? { note: options ?? "" }
      : { note: options?.note ?? "", next_holder_id: options?.next_holder_id };
  return unwrap(window.api.workflow.forward(id, payload, token));
}

export function getForwardCandidates(id, token) {
  return unwrap(window.api.workflow.getForwardCandidates(id, token));
}

export function returnRecord(id, reason, token) {
  return unwrap(window.api.workflow.returnRecord(id, reason, token));
}

export function getQueue(token) {
  return unwrap(window.api.workflow.getQueue(token));
}

export function getTransitions(id, token) {
  return unwrap(window.api.workflow.getTransitions(id, token));
}
