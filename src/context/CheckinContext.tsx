import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { clearToken, getStoredAccessCode } from "@/api/axiosInstance";
import { useCheckin } from "@/hooks/useCheckin";
import {
  submitCheckin,
  savePartialCheckin,
  savePartialGuest,
} from "@/api/checkin.service";
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
  const latestStateRef = React.useRef(state);
  React.useEffect(() => {
    latestStateRef.current = state;
  }, [state]);

  // IDs de clientes creados en ESTA sesión — tracked para evitar PUT innecesarios en submit
  const sessionCreatedIdsRef = React.useRef<Set<number>>(new Set());

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

      if (isPartial) {
        const newClientId = await savePartialCheckin(
          clientId,
          latestStateRef.current.guests[0],
        );
        // Sincronizamos el nuevo clientId en el state para futuros submits
        if (!state.guests[0]?.id) {
          actions.updateGuest(0, "id", newClientId);
        }
        setIsPartialSuccess(true);
        actions.goTo("exito", "forward");
        return;
      }
    

      const result = await submitCheckin({
        bookingId,
        clientId,
        guests: latestStateRef.current.guests,
        horaLlegada: latestStateRef.current.horaLlegada,
        observaciones: latestStateRef.current.observaciones,
  
       
      });
      // Si todavía quedan personas por registrar → pantalla parcial con botón compartir
      setIsPartialSuccess(!result.isComplete);

      // Limpieza completa: los keys del wizard viven en localStorage
      // (los escribe useCheckin.ts), pero por si acaso barremos también
      // sessionStorage para no dejar restos de versiones anteriores.
      SESSION_KEYS_TO_CLEAR.forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      sessionStorage.removeItem(PERSISTENCE_KEY);
      localStorage.removeItem(PERSISTENCE_KEY);
      // Limpiar el set de ids de sesión
      sessionCreatedIdsRef.current.clear();

      actions.goTo("exito", "forward");
    } catch (err: unknown) {
      // Si falla y no es un error que hayamos tirado nosotros con un mensaje,
      // usará el title del ErrorBoundary como fallback.
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

  const wrappedActions = {
    ...actions,
    nextGuest: (
      currIdx: number,
      fromStep: Parameters<typeof actions.nextGuest>[1],
    ) => {
      const proceed = () => {
        const isLastGuest = currIdx >= state.numPersonas - 1;

        if (!isLastGuest && fromStep === "form_contacto") {
          actions.goTo("huesped_intermedio", "forward", currIdx);
        } else {
          // Si ya estamos en la intermedia y el usuario dio a "Continuar", vamos a bienvenida del siguiente
          if (fromStep === "huesped_intermedio") {
            actions.goTo("bienvenida", "forward", currIdx + 1);
          } else {
            actions.nextGuest(currIdx, fromStep);
          }
        }
      };
      const guest = state.guests[currIdx];
      const tieneDatos = !!(guest?.nombre?.trim() || guest?.numDoc?.trim());
      if (!state.bookingId || !tieneDatos || currIdx !== 0) return proceed();

      setIsSubmitting(true);
      savePartialGuest(
        latestStateRef.current.bookingId ?? state.bookingId,
        guest,
        currIdx === 0,
      )
        .then((newId) => {
          if (!guest.id) {
            sessionCreatedIdsRef.current.add(newId);
            actions.updateGuest(currIdx, "id", newId);
          }
        })
        .catch((e) => {
          if (import.meta.env.DEV)
            console.warn("[autoSave huésped]", currIdx, e);
          // No bloqueamos navegación si falla — el submitCheckin final
          // re-intenta sobre todos los huéspedes.
        })
        .finally(() => {
          setIsSubmitting(false);
          proceed();
        });
    },
  };

  const value = {
    state,
    nav,
    actions: wrappedActions,
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
