import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCheckin } from "@/hooks/useCheckin";
import { submitCheckin, savePartialCheckin } from "@/api/chekin.service";
import { CheckinContext } from "./CheckinContextDef";

export const CheckinProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const { token: urlToken, step } = useParams();
  const token = urlToken ?? "new";

  const PERSISTENCE_KEY = `h_ckin_data_${token}`;

  const [state, nav, actions, isLoading] = useCheckin(token, step);

  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isPartialSuccess, setIsPartialSuccess] = useState(false);
  const [validationTrigger, setValidationTrigger] = useState(0);

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

  // ---  LÓGICA DE PERSISTENCIA (LOCALSTORAGE) ---

  useEffect(() => {
    if (state.guests && state.guests.length > 0) {
      const backup = {
        guests: state.guests,
        timestamp: Date.now(),
      };
      localStorage.setItem(PERSISTENCE_KEY, JSON.stringify(backup));
    }
  }, [state.guests, PERSISTENCE_KEY]);

  useEffect(() => {
    const saved = localStorage.getItem(PERSISTENCE_KEY);
    if (saved) {
      try {
        const { guests, timestamp } = JSON.parse(saved);
        const isExpired = Date.now() - timestamp > 2 * 60 * 60 * 1000;

        if (!isExpired && guests && guests.length > 0) {
          if (typeof actions.updateGuest === "function") {
            actions.setGuests?.(guests);
          }
        }
      } catch (e) {
        console.error("Error recuperando persistencia local", e);
      }
    }
  }, [PERSISTENCE_KEY, actions]);

  // --- LIMPIEZA Y AUXILIARES ---

  const clearSubmitError = () => setSubmitError("");
  const triggerFormValidation = () => setValidationTrigger((v) => v + 1);

  const getBackendIds = () => ({
    bookingId: parseInt(
      sessionStorage.getItem(`bookingId_${token}`) ?? "0",
      10,
    ),
    clientId: sessionStorage.getItem(`clientId_${token}`)
      ? parseInt(sessionStorage.getItem(`clientId_${token}`)!, 10)
      : null,
  });

  const SESSION_KEYS_TO_CLEAR = [
    `state_${token}`,
    `history_${token}`,
    `allowedSteps_${token}`,
    `legalPassed_${token}`,
    `hasMinors_${token}`,
    `modoFlujo_${token}`,
    `bookingId_${token}`,
    `clientId_${token}`,
  ];

  const handleChooseMethod = (method: "scan" | "manual") => {
    sessionStorage.setItem(`modoFlujo_${token}`, method);
    actions.setNumPersonas(state.reserva?.numHuespedes ?? 1);
    actions.goTo(
      method === "scan" ? "escanear" : "form_personal",
      "forward",
      0,
    );
  };

  const submitToServer = async (isPartial: boolean): Promise<void> => {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const { bookingId, clientId } = getBackendIds();

      if (isPartial) {
        const newClientId = await savePartialCheckin(
          bookingId,
          clientId,
          state.guests[0],
        );
        sessionStorage.setItem(`clientId_${token}`, String(newClientId));
        setIsPartialSuccess(true);
        return;
      }

      await submitCheckin({
        bookingId,
        clientId,
        guests: state.guests,
        horaLlegada: state.horaLlegada,
        observaciones: state.observaciones,
      });

      setIsPartialSuccess(false);

      SESSION_KEYS_TO_CLEAR.forEach((key) => sessionStorage.removeItem(key));
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
    validationTrigger,
    triggerFormValidation,
    clearSubmitError,
  };

  return (
    <CheckinContext.Provider value={value}>{children}</CheckinContext.Provider>
  );
};
