
import { useState, useCallback } from "react";
import { getCityByCode } from "@/api/cities.service";
import { api } from "@/api/axiosInstance";
import type { PartialGuestData } from "@/types";
 
type OnChangeFn = (key: keyof PartialGuestData, value: unknown) => void;
 
const PAIS_A_ISO2: Record<string, string> = {
  ES: "es", GB: "gb", FR: "fr", DE: "de", IT: "it",
  NL: "nl", BE: "be", PT: "pt", IE: "ie", US: "us",
  CH: "ch", SE: "se", NO: "no", DK: "dk", AT: "at",
  PL: "pl", FI: "fi", MX: "mx", AR: "ar", CO: "co",
};
 
interface ZippopotamResponse {
  places: Array<{
    "place name": string;
    state: string;
  }>;
}
 
export function useZipCode(onChange: OnChangeFn) {
  const [isSearching, setIsSearching] = useState(false);
 
  const buscarCP = useCallback(
    async (cp: string, pais: string) => {
      if (!cp.trim() || !pais) return;
      setIsSearching(true);
 
      try {
        if (pais === "ES") {
          // Backend FastAPI
          const city = await getCityByCode(cp);
          if (city) {
            if (city.name)     onChange("ciudad",    city.name);
            if (city.province) onChange("provincia", city.province);
          }
        } else {
          // API externa para países extranjeros
          const iso2 = PAIS_A_ISO2[pais];
          if (!iso2) return;
 
          const { data } = await api.get<ZippopotamResponse>(
            `https://api.zippopotam.us/${iso2}/${cp.trim()}`,
            { baseURL: "" }
          );
 
          const place = data?.places?.[0];
          if (place) {
            if (place["place name"]) onChange("ciudad",    place["place name"]);
            if (place.state)         onChange("provincia", place.state);
          }
        }
      } catch {
        // CP no encontrado: el usuario lo escribe a mano
      } finally {
        setIsSearching(false);
      }
    },
    [onChange]
  );
 
  return { buscarCP, isSearching };
}