import { useState } from "react";

async function fetchWithTimeout(
  url: string,
  timeoutMs = 3000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

// Caché en memoria para no machacar Zippopotam con el mismo CP
const cache = new Map<string, { ciudad: string; provincia: string }>();

export const useZipCode = (
  onUpdate: (key: string, value: string) => void,
) => {
  const [isSearching, setIsSearching] = useState(false);

  const buscarCP = async (cp: string, paisISO: string = "ES") => {
    if (!cp) return;
    const iso2 = paisISO.substring(0, 2).toUpperCase();

    // En España el CP no mapea a una ciudad en nuestra BBDD
    // (el endpoint /cities/{code} usa codcity INE, no CP postal).
    // El usuario rellena ciudad por autocomplete, no por CP.
    if (iso2 === "ES") return;

    const cpClean = cp.trim();
    const cacheKey = `${iso2}:${cpClean}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      onUpdate("ciudad", cached.ciudad);
      onUpdate("provincia", cached.provincia);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetchWithTimeout(
        `https://api.zippopotam.us/${iso2.toLowerCase()}/${cpClean}`,
      );
      if (response.ok) {
        const data = await response.json();
        if (data.places?.length) {
          const lugar = data.places[0];
          const ciudad = lugar["place name"] ?? "";
          const provincia = lugar["state"] ?? "";
          if (ciudad) {
            onUpdate("ciudad", ciudad);
            onUpdate("provincia", provincia);
            cache.set(cacheKey, { ciudad, provincia });
          }
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Error en búsqueda de CP:", error);
      }
    } finally {
      setIsSearching(false);
    }
  };

  return { buscarCP, isSearching };
};