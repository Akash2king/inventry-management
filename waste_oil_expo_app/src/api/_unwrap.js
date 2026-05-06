import { humanizeApiErrorBody } from "@/utils/apiErrors.js";

export async function unwrap(invokeResult) {
  const res = await invokeResult;
  if (res?.ok) return res.data;
  const err = res?.error;
  if (typeof err === "string") throw new Error(err);
  if (err && typeof err === "object") {
    throw new Error(humanizeApiErrorBody(err));
  }
  throw new Error("Request failed");
}
