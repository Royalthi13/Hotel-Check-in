import { useState } from "react";
import type { PartialGuestData } from "@/types";

type OnChangeFn = (key: keyof PartialGuestData, value: unknown) => void;

export const useZipCode = (onChange: OnChangeFn) => {
  const [isSearching, setIsSearching] = useState(false);

  const mapaPaises: Record<string, string> = {
    España: "es",
    "Reino Unido": "gb",
    Francia: "fr",
    Alemania: "de",
    Italia: "it",
    "Países Bajos": "nl",
    Bélgica: "be",
    Portugal: "pt",
    Irlanda: "ie",
    "Estados Unidos": "us",
    Suiza: "ch",
    Suecia: "se",
    Noruega: "no",
    Dinamarca: "dk",
    Austria: "at",
    Polonia: "pl",
    Finlandia: "fi",
    México: "mx",
    Argentina: "ar",
    Colombia: "co",
  };

  const buscarCP = async (cp: string, paisElegido: string) => {
    if (!paisElegido || !cp) return;

    const codigoIso = mapaPaises[paisElegido];
    if (!codigoIso) return;

    setIsSearching(true);
    try {
      if (paisElegido === "España") {
        console.log("Consultando CP para España: ", cp);
      } else {
        const res = await fetch(`https://api.zippopotam.us/${codigoIso}/${cp}`);
        if (res.ok) {
          const data = await res.json();
          const place = data.places[0];

          onChange("ciudad", place["place name"] || "");
          onChange("provincia", place["state"] || "");

          console.log("CP Encontrado:", place["place name"], place["state"]);
        } else {
          console.log("CP no encontrado en la base internacional.");
        }
      }
    } catch (e) {
      console.log("Error en la petición de Código Postal:", e);
    } finally {
      setIsSearching(false);
    }
  };

  return { buscarCP, isSearching };
};
