import { useState } from "react";

export const useZipCode = (onChange: (key: any, value: any) => void) => {
  const [isSearching, setIsSearching] = useState(false);

  const buscarCP = async (cp: string) => {
    if (cp.length !== 5) return;
    setIsSearching(true);
    try {
      const res = await fetch(`https://api.zippopotam.us/es/${cp}`);
      if (res.ok) {
        const data = await res.json();
        const place = data.places[0];
        onChange("ciudad", place["place name"]);
        onChange("provincia", place["state"]);
      }
    } catch (e) {
      console.error("Error API CP");
    } finally {
      setIsSearching(false);
    }
  };

  return { buscarCP, isSearching };
};
