import { useEffect, useState } from "react";

/**
 * Return `value` only after it has stopped changing for `delay` ms.
 * Lets search inputs update instantly while API calls fire only when typing pauses.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
