export function Toast({ message, type }) {
  const cls =
    type === "error" ? "toast toast-error" : "toast toast-success";
  return <div className={cls}>{message}</div>;
}
