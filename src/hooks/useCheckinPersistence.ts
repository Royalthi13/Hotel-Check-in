import { useEffect, useCallback } from "react";
import type { PartialGuestData } from "@/types";

const STORAGE_KEY = "hotel_checkin_data_v1";

export function useCheckinPersistence(
  guests: PartialGuestData[],
  setGuests: (data: PartialGuestData[]) => void,
) {
  // 1. CARGA INICIAL: Solo se ejecuta una vez cuando se monta la App
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        // Opcional: Validar que los datos no tengan más de 24h
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          setGuests(parsed);
        }
      } catch (error) {
        console.error("Error recuperando persistencia:", error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []); // [] significa que solo corre al cargar la web

  // 2. GUARDADO AUTOMÁTICO: Cada vez que cambie cualquier dato de un huésped
  useEffect(() => {
    if (guests && guests.length > 0) {
      // Solo guardamos si hay datos para no sobreescribir con un array vacío
      localStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
    }
  }, [guests]);

  // 3. LIMPIEZA TOTAL: Función para llamar desde el éxito del envío
  const clearPersistence = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { clearPersistence };
}
