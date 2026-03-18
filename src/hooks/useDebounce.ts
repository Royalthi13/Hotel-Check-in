import { useEffect, useRef } from "react";

export function useDebounce(
  fn: () => void,
  delay: number,
  deps: unknown[],
): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const timer = setTimeout(() => fnRef.current(), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
