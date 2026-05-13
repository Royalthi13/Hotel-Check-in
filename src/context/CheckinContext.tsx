import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  clearToken,
  getStoredAccessCode,
  isStaffLoggedIn,
} from "@/api/axiosInstance";
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
  
  const [state, nav, actions, isLoading, setModoFlujo] = useCheckin(token, step);

  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isPartialSuccess, setIsPartialSuccess] = useState(false);
  
  const isKiosko = isStaffLoggedIn();

  const [accessVerified, setAccessVerified] = useState(() => {
    const payload = getCurrentTokenPayload();
    if (!payload) return false;
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

  // Ref para trackear IDs creados en esta sesión
  const sessionCreatedIdsRef = React.useRef<Set<number>>(new Set());

  const [legalPassed, setLegalPassed] = useState(
    () => sessionStorage.getItem(`legalPassed_${token}`) === "true",
  );
  const [hasMinorsFlag, setHasMinorsFlag] = useState(
    () => sessionStorage.getItem(`hasMinors_${token}`) === "true",
  );

  useEffect(() => {
    sessionStorage.setItem(`legalPassed_${token}`, String(legalPassed));
  }, [legalPassed, token]);

  useEffect(() => {
    sessionStorage.setItem(`hasMinors_${token}`, String(hasMinorsFlag));
  }, [hasMinorsFlag, token]);

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

  // Persistencia de seguridad en sessionStorage
  useEffect(() => {
    if (state.guests && state.guests.length > 0) {
      const backup = {
        guests: state.guests.map((g) => ({ ...g, docFile: null })),
        timestamp: Date.now(),
      };
      sessionStorage.setItem(PERSISTENCE_KEY, JSON.stringify(backup));
    }
  }, [state.guests, PERSISTENCE_KEY]);

  const getBackendIds = () => {
    const bookingId = state.bookingId;
    const clientId = state.clientId ?? state.guests[0]?.id ?? null;
    if (!bookingId) throw new Error(t("checkin.error_invalid_reservation"));
    return { bookingId, clientId };
  };

  const SESSION_KEYS_TO_CLEAR = [
    `state_${token}`,
    `history_${token}`,
    `allowedSteps_${token}`,
    `legalPassed_${token}`,
    `hasMinors_${token}`,
    `modoFlujo_${token}`,
    `verify_attempts_${token}`,
  ];

  // --- LÓGICA DE ENVÍO CORREGIDA (Sin borrar IDs) ---
  const submitToServer = async (isPartial: boolean): Promise<void> => {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const { bookingId, clientId } = getBackendIds();

      if (isPartial) {
        const newId = await savePartialCheckin(clientId, latestStateRef.current.guests[0]);
        if (!state.guests[0]?.id) actions.updateGuest(0, "id", newId);
        setIsPartialSuccess(true);
        actions.goTo("exito", "forward");
        return;
      }

      // ✅ Enviamos los huéspedes tal cual están para permitir PUT (actualización)
      const result = await submitCheckin({
        bookingId,
        clientId,
        guests: latestStateRef.current.guests, 
        horaLlegada: latestStateRef.current.horaLlegada,
        observaciones: latestStateRef.current.observaciones,
      });

      setIsPartialSuccess(!result.isComplete);

      SESSION_KEYS_TO_CLEAR.forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      sessionStorage.removeItem(PERSISTENCE_KEY);
      localStorage.removeItem(PERSISTENCE_KEY);
      sessionCreatedIdsRef.current.clear();

      actions.goTo("exito", "forward");
    } catch (err: any) {
      // Guardamos el error pero NO hacemos throw para evitar la pantalla roja
      setSubmitError(err.message || t("errorBoundary.title"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- ACCIONES WRAPPED CORREGIDAS (Auto-guardado para todos) ---
  const wrappedActions = {
    ...actions,
    nextGuest: (currIdx: number, fromStep: any) => {
      const proceed = () => {
        const isLastGuest = currIdx >= state.numPersonas - 1;
        if (fromStep === "huesped_intermedio") {
          actions.goTo("bienvenida", "forward", currIdx + 1);
          return;
        }
        if (!isLastGuest && fromStep === "form_contacto") {
          if (isKiosko) {
            actions.goTo("form_personal", "forward", currIdx + 1);
            return;
          }
          actions.goTo("huesped_intermedio", "forward", currIdx);
          return;
        }
        actions.nextGuest(currIdx, fromStep);
      };

      const guest = state.guests[currIdx];
      const tieneDatos = !!(guest?.nombre?.trim() || guest?.numDoc?.trim());

      // ✅ Guardamos a cualquier huésped (0, 1, 2...) al avanzar
      if (!state.bookingId || !tieneDatos) return proceed();

      setIsSubmitting(true);
      savePartialGuest(state.bookingId, guest, currIdx === 0)
        .then((newId) => {
          if (!guest.id) {
            sessionCreatedIdsRef.current.add(newId);
            actions.updateGuest(currIdx, "id", newId);
          }
        })
        .catch(console.warn)
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
    handleChooseMethod: (method: "scan" | "manual") => {
      setModoFlujo(method);
      if (nav.guestIndex === 0) actions.setNumPersonas(state.reserva?.numHuespedes ?? 1);
      actions.goTo(method === "scan" ? "escanear" : "form_personal", "forward", nav.guestIndex);
    },
    handleSubmit: () => submitToServer(false),
    handlePartialSubmit: () => submitToServer(true),
    clearSubmitError: () => setSubmitError(""),
    accessVerified,
    setAccessVerified,
  };

  return (
    <CheckinContext.Provider value={value}>{children}</CheckinContext.Provider>
  );
};