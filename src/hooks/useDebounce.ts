import { useEffect, useRef } from "react";

export function useDebounce(
  fn: () => void,
  delay: number,
  deps: unknown[],
): void {
  const fnRef = useRef(fn);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    const timer = setTimeout(() => fnRef.current(), delay);
    return () => clearTimeout(timer);
  }, [...deps, delay]);
}
