import { useEffect, useMemo, useRef, useState } from "react";

export function SearchableVendorSelect({
  vendors = [],
  value,
  onChange,
  disabled,
  error,
  id = "vendor_id",
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef(null);

  const selected = useMemo(
    () => vendors.find((v) => v.id === value) || null,
    [vendors, value],
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return vendors;
    return vendors.filter((v) => {
      const name = (v.name || "").toLowerCase();
      const contact = (v.contact || "").toLowerCase();
      return name.includes(t) || contact.includes(t);
    });
  }, [vendors, q]);

  useEffect(() => {
    function onDoc(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <div ref={rootRef} className="searchable-select">
      <button
        type="button"
        id={id}
        className={`searchable-select__trigger${error ? " searchable-select__trigger--error" : ""}`}
        disabled={disabled || vendors.length === 0}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => !disabled && vendors.length > 0 && setOpen((o) => !o)}
      >
        <span className="searchable-select__trigger-text">
          {selected
            ? `${selected.name}${selected.contact ? ` · ${selected.contact}` : ""}`
            : "— Search or select vendor —"}
        </span>
        <span className="searchable-select__chev" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div className="searchable-select__dropdown" role="listbox">
          <input
            type="search"
            className="searchable-select__search"
            placeholder="Type to filter vendors…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="searchable-select__list">
            {filtered.length === 0 ? (
              <div className="searchable-select__empty">No matches</div>
            ) : (
              filtered.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="option"
                  aria-selected={v.id === value}
                  className={`searchable-select__option${v.id === value ? " searchable-select__option--active" : ""}`}
                  onClick={() => {
                    onChange(v.id);
                    setOpen(false);
                  }}
                >
                  <span className="searchable-select__opt-name">{v.name}</span>
                  {v.contact ? (
                    <span className="searchable-select__opt-meta">{v.contact}</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
