import { useState } from "react";
import { getCityByCode } from "@/api/cities.service";

async function fetchWithTimeout(url: string, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const useZipCode = (onUpdate: (key: string, value: string) => void) => {
  const [isSearching, setIsSearching] = useState(false);

  const buscarCP = async (cp: string, paisISO: string = "ES") => {
    if (!cp) return;
    setIsSearching(true);

    try {
      const iso2 = paisISO.substring(0, 2).toUpperCase();

      if (iso2 === "ES") {
        // GET /cities/{code} (requiere auth, se maneja en apiAuth de axios).
        // Probamos primero con el CP tal cual y luego con padStart(6, "0")
        // por si el codcity en BD está con ceros a la izquierda.
        const candidates = [cp.trim(), cp.trim().padStart(6, "0")];
        for (const code of candidates) {
          try {
            const city = await getCityByCode(code);
            if (city?.name) {
              onUpdate("ciudad", city.name);
              onUpdate("codCity", city.codcity);
              return;
            }
          } catch { /* 404 → probamos siguiente candidato */ }
        }
      } else {
        // Zippopotam (API pública)
        const codigoPaisLcase = iso2.toLowerCase();
        const response = await fetchWithTimeout(
          `https://api.zippopotam.us/${codigoPaisLcase}/${cp.trim()}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.places?.length) {
            const lugar = data.places[0];
            onUpdate("ciudad", lugar["place name"]);
            onUpdate("provincia", lugar["state"]);
          }
        }
      }
    } catch (error) {
      console.warn("Error en búsqueda de CP:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return { buscarCP, isSearching };
};