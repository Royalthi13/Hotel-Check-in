import { useState, useCallback } from "react";
import { searchCitiesByName } from "@/api/cities.service";

export interface Municipio {
  nombre: string;
  codcity: string;
}

// Mapeo oficial de códigos de provincia (INE)
export const INE_A_PROVINCIA: Record<string, string> = {
  "01": "Álava",
  "02": "Albacete",
  "03": "Alicante",
  "04": "Almería",
  "05": "Ávila",
  "06": "Badajoz",
  "07": "Baleares",
  "08": "Barcelona",
  "09": "Burgos",
  "10": "Cáceres",
  "11": "Cádiz",
  "12": "Castellón",
  "13": "Ciudad Real",
  "14": "Córdoba",
  "15": "A Coruña",
  "16": "Cuenca",
  "17": "Girona",
  "18": "Granada",
  "19": "Guadalajara",
  "20": "Gipuzkoa",
  "21": "Huelva",
  "22": "Huesca",
  "23": "Jaén",
  "24": "León",
  "25": "Lleida",
  "26": "La Rioja",
  "27": "Lugo",
  "28": "Madrid",
  "29": "Málaga",
  "30": "Murcia",
  "31": "Navarra",
  "32": "Ourense",
  "33": "Asturias",
  "34": "Palencia",
  "35": "Las Palmas",
  "36": "Pontevedra",
  "37": "Salamanca",
  "38": "Santa Cruz de Tenerife",
  "39": "Cantabria",
  "40": "Segovia",
  "41": "Sevilla",
  "42": "Soria",
  "43": "Tarragona",
  "44": "Teruel",
  "45": "Toledo",
  "46": "Valencia",
  "47": "Valladolid",
  "48": "Bizkaia",
  "49": "Zamora",
  "50": "Zaragoza",
  "51": "Ceuta",
  "52": "Melilla",
};

const PROVINCIAS_INE: Record<string, string> = Object.entries(
  INE_A_PROVINCIA,
).reduce((acc, [code, name]) => ({ ...acc, [name.toLowerCase()]: code }), {});

export function usePlaces() {
  const [sugerenciasMunicipios, setSugerenciasMunicipios] = useState<
    Municipio[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);

  const cargarMunicipios = useCallback(
    async (texto: string, provinciaSeleccionada?: string) => {
      if (!texto || texto.length < 2) {
        setSugerenciasMunicipios([]);
        return;
      }
      setIsLoading(true);
      try {
        let cities = await searchCitiesByName(texto);

        if (provinciaSeleccionada) {
          const codProv = PROVINCIAS_INE[provinciaSeleccionada.toLowerCase()];
          if (codProv) {
            cities = cities.filter(
              (c) => c.codcity && c.codcity.startsWith(codProv),
            );
          }
        }

        setSugerenciasMunicipios(
          cities.map((c) => ({ nombre: c.name, codcity: c.codcity })),
        );
      } catch {
        setSugerenciasMunicipios([]);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const limpiarSugerencias = useCallback(
    () => setSugerenciasMunicipios([]),
    [],
  );

  return {
    sugerenciasMunicipios,
    sugerenciasProvincias: Object.values(INE_A_PROVINCIA),
    cargarMunicipios,
    limpiarSugerencias,
    isLoading,
  };
}
