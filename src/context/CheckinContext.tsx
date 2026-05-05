import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { clearToken, getStoredAccessCode } from "@/api/axiosInstance";
import { useCheckin } from "@/hooks/useCheckin";
import { submitCheckin, savePartialCheckin } from "@/api/checkin.service";
import { CheckinContext } from "./CheckinContextDef";
import { getCurrentTokenPayload } from "@/api/auth.service";
export const CheckinProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const { token: urlToken, step } = useParams();
  const token = urlToken ?? "new";
  const PERSISTENCE_KEY = `h_ckin_data_${token}`;
  const [state, nav, actions, isLoading, setModoFlujo] = useCheckin(
    token,
    step,
  );

  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isPartialSuccess, setIsPartialSuccess] = useState(false);
  // Verificación = tener JWT válido. La pantalla de verificación lo consigue;
  // tras éxito hacemos un reload para que useCheckin recargue datos con el token.
  const [accessVerified, setAccessVerified] = useState(() => {
    const payload = getCurrentTokenPayload();
    if (!payload) return false;
    // Verificar que el token pertenece al access_code actual de la URL
    const storedCode = getStoredAccessCode();
    if (storedCode && storedCode !== token) {
      clearToken();
      return false;
    }
    return true;
  });

  const [legalPassed, setLegalPassed] = useState(
    () => sessionStorage.getItem(`legalPassed_${token}`) === "true",
  );
  const [hasMinorsFlag, setHasMinorsFlag] = useState(
    () => sessionStorage.getItem(`hasMinors_${token}`) === "true",
  );

  // --- PERSISTENCIA LEGAL ---
  useEffect(() => {
    sessionStorage.setItem(`legalPassed_${token}`, String(legalPassed));
  }, [legalPassed, token]);

  useEffect(() => {
    sessionStorage.setItem(`hasMinors_${token}`, String(hasMinorsFlag));
  }, [hasMinorsFlag, token]);

  // --- DETECTOR ONLINE/OFFLINE ---
  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);

    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // --- PERSISTENCIA DE HUÉSPEDES (sessionStorage, se vacía al cerrar pestaña) ---
  useEffect(() => {
    if (state.guests && state.guests.length > 0) {
      const backup = {
        guests: state.guests.map((g) => ({ ...g, docFile: null })),
        timestamp: Date.now(),
      };
      sessionStorage.setItem(PERSISTENCE_KEY, JSON.stringify(backup));
    }
  }, [state.guests, PERSISTENCE_KEY]);

  // --- LIMPIEZA Y AUXILIARES ---
  const clearSubmitError = () => setSubmitError("");

  const getBackendIds = () => {
    const bookingId = state.bookingId;
    // clientId puede venir del state o haberse generado en un partial-submit previo
    const clientId = state.clientId ?? state.guests[0]?.id ?? null;

    if (!bookingId) {
      throw new Error(t("checkin.error_invalid_reservation"));
    }

    return { bookingId, clientId };
  };

  const SESSION_KEYS_TO_CLEAR = [
    `state_${token}`,
    `history_${token}`,
    `allowedSteps_${token}`,
    `legalPassed_${token}`,
    `hasMinors_${token}`,
    `modoFlujo_${token}`,
    `verify_attempts_${token}`, // Añadido por si usas el token en vez de bookingRef
  ];

  const handleChooseMethod = (method: "scan" | "manual") => {
    setModoFlujo(method);

    if (nav.guestIndex === 0) {
      actions.setNumPersonas(state.reserva?.numHuespedes ?? 1);
    }

    actions.goTo(
      method === "scan" ? "escanear" : "form_personal",
      "forward",
      nav.guestIndex,
    );
  };

  const submitToServer = async (isPartial: boolean): Promise<void> => {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const { bookingId, clientId } = getBackendIds();

      // Función para sanear los datos antes de enviarlos a la API
      const sanitizeGuestData = (guest: any) => {
        if (!guest || !guest.telefono) return guest;

        const prefijoActual = guest.prefijo || "+34";
        let telefonoLimpio = guest.telefono.trim();

        // Si el teléfono ya trae el prefijo pegado (ej. por venir del backend), se lo extirpamos
        if (telefonoLimpio.startsWith(prefijoActual)) {
          telefonoLimpio = telefonoLimpio
            .substring(prefijoActual.length)
            .trim();
        }

        return {
          ...guest,
          telefono: `${prefijoActual} ${telefonoLimpio}`,
        };
      };

      if (isPartial) {
        // Limpiamos solo el huésped actual antes de guardarlo
        const sanitizedGuest = sanitizeGuestData(state.guests[nav.guestIndex]);

        const newClientId = await savePartialCheckin(clientId, sanitizedGuest);

        if (!state.guests[nav.guestIndex]?.id) {
          actions.updateGuest(nav.guestIndex, "id", newClientId);
        }

        setIsPartialSuccess(true);
        return;
      }

      // Limpiamos todos los huéspedes para el guardado final
      const sanitizedGuests = state.guests.map(sanitizeGuestData);

      await submitCheckin({
        bookingId,
        clientId,
        guests: sanitizedGuests,
        horaLlegada: state.horaLlegada,
        observaciones: state.observaciones,
      });

      setIsPartialSuccess(false);
      SESSION_KEYS_TO_CLEAR.forEach((key) => sessionStorage.removeItem(key));
      sessionStorage.removeItem(PERSISTENCE_KEY);
      localStorage.removeItem(PERSISTENCE_KEY);

      actions.goTo("exito", "forward");
    } catch (err: unknown) {
      let msg = t("errorBoundary.title");
      if (err instanceof Error) msg = err.message;
      else if (typeof err === "string") msg = err;

      setSubmitError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => submitToServer(false);
  const handlePartialSubmit = () => submitToServer(true);

  const value = {
    state,
    nav,
    actions,
    isLoading,
    submitError,
    isSubmitting,
    isOffline,
    isPartialSuccess,
    legalPassed,
    setLegalPassed,
    hasMinorsFlag,
    setHasMinorsFlag,
    token,
    handleChooseMethod,
    handleSubmit,
    handlePartialSubmit,
    clearSubmitError,
    accessVerified,
    setAccessVerified,
  };

  return (
    <CheckinContext.Provider value={value}>{children}</CheckinContext.Provider>
  );
};
