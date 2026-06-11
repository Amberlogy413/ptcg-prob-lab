import { useEffect, useState } from "react";

/** True below the mobile breakpoint (docs/04 §8: <768px → wizard flow). */
export function useIsNarrow(query = "(max-width: 767px)"): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const m = window.matchMedia(query);
    const onChange = () => setNarrow(m.matches);
    m.addEventListener("change", onChange);
    setNarrow(m.matches);
    return () => m.removeEventListener("change", onChange);
  }, [query]);
  return narrow;
}
