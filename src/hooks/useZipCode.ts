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
        if (pais === "ES") {
          const provCode = cp.substring(0, 2);
          if (INE_A_PROVINCIA[provCode]) {
            onChange("provincia", INE_A_PROVINCIA[provCode]);
          }
        } else {
          const iso2 = PAIS_A_ISO2[pais];
          if (!iso2) return;

          const res = await fetch(
            `https://api.zippopotam.us/${iso2}/${cp.trim()}`,
          );
          if (!res.ok) return;

          const data: ZippopotamResponse = await res.json();
          const place = data?.places?.[0];

          if (place) {
            if (place["place name"]) onChange("ciudad", place["place name"]);
            if (place.state) onChange("provincia", place.state);
          }
        }
      } catch {
      } finally {
        setIsSearching(false);
      }
    },
    [onChange],
  );

  return { buscarCP, isSearching };
}
