import { useState, useCallback } from "react";
import { searchCitiesByName } from "@/api/cities.service";

// La tabla cities solo tiene codcity y name.
// El autocomplete devuelve nombres de ciudades.
export interface Municipio {
  nombre: string;
}

export function usePlaces() {
  const [sugerenciasMunicipios, setSugerenciasMunicipios] = useState<Municipio[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Autocomplete de ciudades a partir del texto escrito
  const cargarMunicipios = useCallback(async (texto: string) => {
    if (!texto || texto.length < 2) {
      setSugerenciasMunicipios([]);
      return;
    }
    setIsLoading(true);
    try {
      const cities = await searchCitiesByName(texto);
      setSugerenciasMunicipios(cities.map((c) => ({ nombre: c.name })));
    } catch {
      setSugerenciasMunicipios([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const limpiarSugerencias = useCallback(() => {
    setSugerenciasMunicipios([]);
  }, []);

  return {
    sugerenciasMunicipios,
    // Compatibilidad con el código existente que usa cargarProvincias
    sugerenciasProvincias: [] as string[],
    cargarProvincias: (_texto: string) => Promise.resolve(),
    cargarMunicipios,
    limpiarSugerencias,
    isLoading,
  };
}