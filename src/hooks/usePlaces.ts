import { useState } from "react";

export interface Municipio {
  nombre: string;
  provincia: string;
}

const API_BASE_URL = "https://tu-api-backend.com/api";

const quitarAcentos = (str: string) => {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

export const usePlaces = () => {
  const [sugerenciasProvincias, setSugerenciasProvincias] = useState<string[]>(
    [],
  );
  const [sugerenciasMunicipios, setSugerenciasMunicipios] = useState<
    Municipio[]
  >([]);

  const cargarProvincias = async (texto: string) => {
    if (!texto) return setSugerenciasProvincias([]);

    const textoLimpio = quitarAcentos(texto);

    try {
      const res = await fetch(
        `${API_BASE_URL}/provincias?q=${encodeURIComponent(textoLimpio)}`,
      );
      if (!res.ok) throw new Error("Error en servidor de provincias");

      const data = await res.json();
      setSugerenciasProvincias(data);
    } catch (error) {
      console.error("Fallo al cargar provincias:", error);
      setSugerenciasProvincias([]);
    }
  };

  const cargarMunicipios = async (texto: string, provincia?: string) => {
    if (!texto) return setSugerenciasMunicipios([]);

    const textoLimpio = quitarAcentos(texto);

    try {
      const params = new URLSearchParams({ q: textoLimpio });
      if (provincia) params.append("provincia", provincia);

      const res = await fetch(
        `${API_BASE_URL}/municipios?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Error en servidor de municipios");

      const data = await res.json();
      setSugerenciasMunicipios(data);
    } catch (error) {
      console.error("Fallo al cargar municipios:", error);
      setSugerenciasMunicipios([]);
    }
  };

  return {
    sugerenciasProvincias: sugerenciasProvincias || [],
    sugerenciasMunicipios: sugerenciasMunicipios || [],
    cargarProvincias,
    cargarMunicipios,
  };
};
