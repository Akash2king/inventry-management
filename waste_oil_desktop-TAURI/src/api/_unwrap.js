export async function unwrap(invokeResult) {
  const res = await invokeResult;
  if (res?.ok) return res.data;
  const err = res?.error;
  if (typeof err === "string") throw new Error(err);
  if (err && typeof err === "object") {
    if (typeof err.detail === "string") throw new Error(err.detail);
    throw new Error(JSON.stringify(err));
  }
  throw new Error("Request failed");
}
