import { useState, useCallback } from "react";
import type { PartialGuestData } from "@/types";
import { INE_A_PROVINCIA } from "./usePlaces";

type OnChangeFn = (key: keyof PartialGuestData, value: unknown) => void;

const PAIS_A_ISO2: Record<string, string> = {
  GB: "gb",
  FR: "fr",
  DE: "de",
  IT: "it",
  NL: "nl",
  BE: "be",
  PT: "pt",
  IE: "ie",
  US: "us",
  CH: "ch",
  SE: "se",
  NO: "no",
  DK: "dk",
  AT: "at",
  PL: "pl",
  FI: "fi",
  MX: "mx",
  AR: "ar",
  CO: "co",
  CA: "ca",
  AU: "au",
  NZ: "nz",
  BR: "br",
  CL: "cl",
};

interface ZippopotamPlace {
  "place name": string;
  state: string;
}

interface ZippopotamResponse {
  places: ZippopotamPlace[];
}

export function useZipCode(onChange: OnChangeFn) {
  const [isSearching, setIsSearching] = useState(false);

  const buscarCP = useCallback(
    async (cp: string, pais: string) => {
      if (!cp.trim() || !pais) return;
      setIsSearching(true);

      try {
        // 1. Declaramos cpFormateado (esto soluciona el error "Cannot find name")
        const cpFormateado = cp.padStart(5, "0");

        if (pais === "ES" || pais === "ESP") {
          const provCode = cpFormateado.substring(0, 2);
          if (INE_A_PROVINCIA[provCode]) {
            onChange("provincia", INE_A_PROVINCIA[provCode]);
          }

          if (cpFormateado.length === 5) {
            // Ajusta esta URL a la ruta real de tu backend
            const res = await fetch(`/api/cities/zipcode/${cpFormateado}`);
            if (!res.ok) throw new Error("City lookup failed");

            const cityDB = await res.json();

            if (cityDB) {
              if (cityDB.name) onChange("ciudad", cityDB.name);
              if (cityDB.cod_city) onChange("codCity", cityDB.cod_city);
            }
          }
        } else {
          // ==========================================
          // LÓGICA INTERNACIONAL (ZIPPOPOTAM)
          // ==========================================
          if (cp.length >= 3) {
            // Usamos tu diccionario PAIS_A_ISO2 para solucionar el warning
            const isoCountry =
              PAIS_A_ISO2[pais] || pais.substring(0, 2).toLowerCase();

            const res = await fetch(
              `https://api.zippopotam.us/${isoCountry}/${cp}`,
            );
            if (!res.ok) throw new Error("International CP not found");

            const data: ZippopotamResponse = await res.json();
            const place = data?.places?.[0];

            if (place) {
              if (place["place name"]) onChange("ciudad", place["place name"]);
              if (place.state) onChange("provincia", place.state);
              onChange("codCity", ""); // Limpiamos el codCity porque es internacional
            }
          }
        }
      } catch (error) {
        console.warn("Error al buscar el CP:", error);
      } finally {
        setIsSearching(false);
      }
    },
    [onChange],
  );

  return { buscarCP, isSearching };
}
