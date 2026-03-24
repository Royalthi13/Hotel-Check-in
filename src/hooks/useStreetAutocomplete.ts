import { useState, useCallback, useRef } from "react";

export interface StreetSuggestion {
  label: string;
  direccion: string;
  cp?: string;
  ciudad?: string;
  provincia?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CARTOCIUDAD — endpoint correcto (REST, no JSONP)
// El endpoint /candidates devuelve JSON limpio y acepta CORS desde browser.
// El error 406 venía de usar el endpoint JSONP con headers incorrectos.
// ─────────────────────────────────────────────────────────────────────────────
async function fetchCartociudad(
  query: string,
  signal: AbortSignal,
): Promise<StreetSuggestion[]> {
  const params = new URLSearchParams({
    q:       query,
    limit:   "6",
    type:    "road,address",   // calles y portales
    lang:    "es",
  });

  // Endpoint REST correcto — sin el "Jsonp" del nombre
  const res = await fetch(
    `https://www.cartociudad.es/geocoder/api/geocoder/candidates?${params}`,
    {
      signal,
      // CRÍTICO: no pasar Accept personalizado — deja que el browser use el default.
      // El 406 anterior era porque el header Accept: application/json
      // no coincidía con lo que el servidor espera (text/plain o */*).
      headers: {},
    },
  );

  if (!res.ok) throw new Error(`cartociudad ${res.status}`);

  const data = await res.json();

  // La respuesta puede ser array directo o { candidates: [...] }
  const candidates: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.candidates)
      ? data.candidates
      : [];

  const seen = new Set<string>();
  const mapped: StreetSuggestion[] = [];

  for (const c of candidates) {
    // Cartociudad puede devolver distintos campos según la versión
    const via      = c.address ?? c.via ?? c.tip_via ?? "";
    const numero   = c.portalNumber ?? c.firstPortalNumber ?? c.num ?? "";
    const cp       = String(c.postalCode ?? c.cod_postal ?? c.cp ?? "");
    const ciudad   = c.municipality ?? c.muni ?? c.city ?? "";
    const provincia = c.province ?? c.prov ?? "";

    if (!via) continue;

    const direccion = numero ? `${via}, ${numero}` : via;
    const key       = `${direccion}|${ciudad}|${cp}`;
    if (seen.has(key)) continue;
    seen.add(key);

    mapped.push({
      label: [direccion, cp, ciudad, provincia].filter(Boolean).join(", "),
      direccion,
      cp,
      ciudad,
      provincia,
    });
  }

  return mapped;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENSTREETMAP NOMINATIM — fallback simple
// Se usa solo si Cartociudad falla. Nominatim no tiene el CORS issue de Photon
// porque su política de CORS es más permisiva (* para GET).
// ─────────────────────────────────────────────────────────────────────────────
async function fetchNominatim(
  query: string,
  signal: AbortSignal,
): Promise<StreetSuggestion[]> {
  const params = new URLSearchParams({
    q:               `${query}, España`,
    countrycodes:    "es",
    format:          "json",
    addressdetails:  "1",
    limit:           "6",
    "accept-language": "es",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    { signal },
  );

  if (!res.ok) throw new Error(`nominatim ${res.status}`);

  const data = await res.json();
  const seen = new Set<string>();
  const mapped: StreetSuggestion[] = [];

  for (const item of data) {
    const addr = item.address ?? {};
    const road = addr.road ?? addr.pedestrian ?? addr.footway ?? "";
    if (!road) continue;

    const housenumber = addr.house_number ?? "";
    const direccion   = housenumber ? `${road}, ${housenumber}` : road;
    const cp          = addr.postcode ?? "";
    const ciudad      = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? "";
    const provincia   = addr.state ?? "";

    const key = `${direccion}|${ciudad}|${cp}`;
    if (seen.has(key)) continue;
    seen.add(key);

    mapped.push({ label: [direccion, cp, ciudad, provincia].filter(Boolean).join(", "), direccion, cp, ciudad, provincia });
  }

  return mapped;
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function useStreetAutocomplete() {
  const [suggestions, setSuggestions] = useState<StreetSuggestion[]>([]);
  const [loading, setLoading]         = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const _fetch = useCallback(async (query: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    setLoading(true);

    try {
      const results = await fetchCartociudad(query, signal);

      if (results.length > 0) {
        setSuggestions(results);
        return;
      }

      // Cartociudad respondió OK pero 0 resultados → Nominatim
      const fallback = await fetchNominatim(query, signal);
      setSuggestions(fallback);

    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;

      // Cartociudad falló → Nominatim silencioso
      try {
        const fallback = await fetchNominatim(query, signal);
        setSuggestions(fallback);
      } catch {
        setSuggestions([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const search = useCallback(
    (query: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (query.length < 4) {
        setSuggestions([]);
        return;
      }
      timerRef.current = setTimeout(() => _fetch(query), 400);
    },
    [_fetch],
  );

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    setSuggestions([]);
    setLoading(false);
  }, []);

  return { suggestions, loading, search, clear };
}