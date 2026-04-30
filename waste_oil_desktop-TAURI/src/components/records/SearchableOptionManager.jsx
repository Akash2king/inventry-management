import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

export function SearchableOptionManager({
  id,
  value,
  onChange,
  options = [],
  placeholder,
  searchPlaceholder,
  allowManage = false,
  onAddOption,
  onDeleteOption,
  error = false,
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [newOption, setNewOption] = useState("");
  const [busyAdd, setBusyAdd] = useState(false);
  const [busyDeleteId, setBusyDeleteId] = useState("");
  const rootRef = useRef(null);
  const deferredQ = useDeferredValue(q);

  const selected = useMemo(
    () => options.find((o) => o.value === value) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const t = deferredQ.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => (o.value || "").toLowerCase().includes(t));
  }, [options, deferredQ]);
  const limited = useMemo(() => filtered.slice(0, 120), [filtered]);

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

  const canAdd = allowManage && newOption.trim().length > 0;

  return (
    <div ref={rootRef} className="searchable-select">
      <button
        type="button"
        id={id}
        className={`searchable-select__trigger${error ? " searchable-select__trigger--error" : ""}`}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="searchable-select__trigger-text">
          {selected?.value || value || placeholder || "Select option"}
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
            placeholder={searchPlaceholder || "Search options..."}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <div className="searchable-select__list">
            {limited.length === 0 ? (
              <div className="searchable-select__empty">No matches</div>
            ) : (
              limited.map((o) => (
                <div key={o.id || o.value} className="searchable-option-row">
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={`searchable-select__option${o.value === value ? " searchable-select__option--active" : ""}`}
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                  >
                    <span className="searchable-select__opt-name">{o.value}</span>
                  </button>
                  {allowManage && o.id ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={busyDeleteId === o.id}
                      onClick={async () => {
                        try {
                          setBusyDeleteId(o.id);
                          await onDeleteOption?.(o);
                        } finally {
                          setBusyDeleteId("");
                        }
                      }}
                      title="Delete option"
                    >
                      {busyDeleteId === o.id ? "Deleting..." : "Delete"}
                    </button>
                  ) : null}
                </div>
              ))
            )}
            {filtered.length > limited.length ? (
              <div className="searchable-select__empty">
                Showing first {limited.length} options. Refine search to see more.
              </div>
            ) : null}
          </div>
          {allowManage ? (
            <div className="searchable-option-add">
              <input
                type="text"
                value={newOption}
                placeholder="Add new option"
                onChange={(e) => setNewOption(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!canAdd || busyAdd}
                onClick={async () => {
                  const v = newOption.trim();
                  if (!v) return;
                  try {
                    setBusyAdd(true);
                    await onAddOption?.(v);
                    setNewOption("");
                  } finally {
                    setBusyAdd(false);
                  }
                }}
              >
                {busyAdd ? "Adding..." : "Add"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
