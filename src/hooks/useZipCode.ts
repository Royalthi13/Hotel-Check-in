import { useState } from "react";

export const useZipCode = (onUpdate: (key: string, value: string) => void) => {
  const [isSearching, setIsSearching] = useState(false);

  const buscarCP = async (cp: string, paisISO: string = "ES") => {
    if (!cp) return;

    setIsSearching(true);
    try {
      // Normalizamos el código de país a 2 letras (ES, FR, PT...)
      const iso2 = paisISO.substring(0, 2).toUpperCase();

      if (iso2 === "ES") {
        // --- CASO ESPAÑA: Backend Propio ---
        // El codcity de tu backend es el CP con un 0 delante (ej: "28003" -> "028003")
        // Usamos padStart(6, '0') para asegurar que tenga 6 dígitos empezando por 0
        const codCityBackend = cp.padStart(6, "0");

        const response = await fetch(`/api/cities/${codCityBackend}`);

        if (!response.ok) throw new Error("Ciudad no encontrada en backend");

        const data = await response.json();

        // Si tu backend devuelve { nombre: "Madrid", ... }
        if (data && data.nombre) {
          onUpdate("ciudad", data.nombre);

          // Nota: Si el backend no devuelve provincia, puedes intentar sacarla
          // de los 2 primeros dígitos del CP (28 = Madrid, 08 = Barcelona, etc.)
          // Pero por ahora solo rellenamos lo que el backend confirma.
        }
      } else {
        // --- RESTO DEL MUNDO: Zippopotam ---
        const codigoPaisLcase = iso2.toLowerCase();
        const response = await fetch(
          `https://api.zippopotam.us/${codigoPaisLcase}/${cp}`,
        );

        if (response.ok) {
          const data = await response.json();
          if (data.places && data.places.length > 0) {
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
