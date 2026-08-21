export function Toast({ message, type }) {
  const cls =
    type === "error" ? "toast toast-error" : "toast toast-success";
  const text = String(message || "");
  const display =
    text.length > 220
      ? `${text.slice(0, 219)}…`
      : text.includes("<!DOCTYPE") || text.toLowerCase().includes("<html")
        ? "Server error. Check the backend connection."
        : text;
  return (
    <div className={cls} title={text.length > 220 ? text.slice(0, 500) : undefined}>
      {display}
    </div>
  );
}
