import { useState } from "react";

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
        // España: backend propio — codcity = CP con padStart(6, '0')
        const codCityBackend = cp.padStart(6, "0");
        const response = await fetchWithTimeout(`/api/cities/${codCityBackend}`);
        if (!response.ok) throw new Error("Ciudad no encontrada en backend");
        const data = await response.json();
        if (data && data.nombre) onUpdate("ciudad", data.nombre);
      } else {
        // Resto del mundo: Zippopotam
        const codigoPaisLcase = iso2.toLowerCase();
        const response = await fetchWithTimeout(
          `https://api.zippopotam.us/${codigoPaisLcase}/${cp}`,
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