import { useEffect, useRef } from 'react';

/**
 * Ejecuta `fn` tras `delay` ms de inactividad.
 * Se cancela si el componente desmonta o si cambian las deps antes de que expire.
 *
 * Uso:
 *   const debouncedValidate = useDebounce(() => validate(data.numDoc), 500, [data.numDoc]);
 */
export function useDebounce(fn: () => void, delay: number, deps: unknown[]): void {
  const fnRef = useRef(fn);
  fnRef.current = fn; // siempre la versión más reciente sin re-crear el effect

  useEffect(() => {
    const timer = setTimeout(() => fnRef.current(), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}