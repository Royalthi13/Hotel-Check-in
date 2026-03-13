import { useState } from "react";

export const useZipCode = (onChange: (key: any, value: any) => void) => {
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
      const res = await fetch(`https://api.zippopotam.us/${codigoIso}/${cp}`);
      if (res.ok) {
        const data = await res.json();
        const place = data.places[0];
        onChange("ciudad", place["place name"]);
        onChange("provincia", place["state"]);
      }
    } catch (e) {
      console.log("No se encontró el CP en la base de datos internacional.");
    } finally {
      setIsSearching(false);
    }
  };

  return { buscarCP, isSearching };
};
