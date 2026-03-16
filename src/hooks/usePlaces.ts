import { useState } from 'react';

export interface Municipio {
  nombre: string;
  provincia: string;
}

// En desarrollo sin backend, las llamadas fallan silenciosamente y devuelven [].
// Cuando el backend esté listo, cambia esta constante a la URL real.
const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

const quitarAcentos = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export function usePlaces() {
  const [sugerenciasProvincias, setSugerenciasProvincias] = useState<string[]>([]);
  const [sugerenciasMunicipios, setSugerenciasMunicipios] = useState<Municipio[]>([]);

  const cargarProvincias = async (texto: string) => {
    if (!texto || !API_BASE_URL) {
      setSugerenciasProvincias([]);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/provincias?q=${encodeURIComponent(quitarAcentos(texto))}`,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: string[] = await res.json();
      setSugerenciasProvincias(data);
    } catch {
      // Fallo silencioso: el campo sigue funcionando como input libre
      setSugerenciasProvincias([]);
    }
  };

  const cargarMunicipios = async (texto: string, provincia?: string) => {
    if (!texto || !API_BASE_URL) {
      setSugerenciasMunicipios([]);
      return;
    }
    try {
      const params = new URLSearchParams({ q: quitarAcentos(texto) });
      if (provincia) params.append('provincia', provincia);
      const res = await fetch(`${API_BASE_URL}/api/municipios?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Municipio[] = await res.json();
      setSugerenciasMunicipios(data);
    } catch {
      setSugerenciasMunicipios([]);
    }
  };

  return {
    sugerenciasProvincias,
    sugerenciasMunicipios,
    cargarProvincias,
    cargarMunicipios,
  };
}