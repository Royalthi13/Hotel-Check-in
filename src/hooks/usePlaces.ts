
import { useState, useCallback } from "react";
import { searchCitiesByName } from "@/api/cities.service";
 
export interface Municipio {
  nombre:    string;
  provincia: string;
}
 
export function usePlaces() {
  const [sugerenciasProvincias, setSugerenciasProvincias] = useState<string[]>([]);
  const [sugerenciasMunicipios, setSugerenciasMunicipios] = useState<Municipio[]>([]);
  const [isLoading, setIsLoading] = useState(false);
 
  const cargarProvincias = useCallback(async (texto: string) => {
    if (!texto || texto.length < 2) {
      setSugerenciasProvincias([]);
      return;
    }
    setIsLoading(true);
    try {
      const cities = await searchCitiesByName(texto);
      const provincias = [
        ...new Set(
          cities
            .map((c) => c.province)
            .filter((p) => p && p.toLowerCase().includes(texto.toLowerCase()))
        ),
      ].slice(0, 8);
      setSugerenciasProvincias(provincias);
    } catch {
      setSugerenciasProvincias([]);
    } finally {
      setIsLoading(false);
    }
  }, []);
 
  const cargarMunicipios = useCallback(
    async (texto: string, provincia?: string) => {
      if (!texto || texto.length < 2) {
        setSugerenciasMunicipios([]);
        return;
      }
      setIsLoading(true);
      try {
        const cities = await searchCitiesByName(texto);
        const municipios: Municipio[] = cities
          .filter((c) =>
            provincia
              ? c.province.toLowerCase() === provincia.toLowerCase()
              : true
          )
          .map((c) => ({ nombre: c.name, provincia: c.province }));
        setSugerenciasMunicipios(municipios);
      } catch {
        setSugerenciasMunicipios([]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );
 
  return {
    sugerenciasProvincias,
    sugerenciasMunicipios,
    cargarProvincias,
    cargarMunicipios,
    isLoading,
  };
}
 