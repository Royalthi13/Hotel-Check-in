import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCheckin } from "@/hooks/useCheckin";
import { submitCheckin, savePartialCheckin } from "@/api/chekin.service";
import { clearCatalogsCache } from "@/api/catalogs.service";
import type { CheckinState, CheckinNav, CheckinActions } from "@/types";
import { CheckinContext } from "./CheckinContextDef";

export const CheckinProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const { token: urlToken, step } = useParams();
  const token = urlToken ?? "new";

  const [state, nav, actions, isLoading] = useCheckin(token, step);

  const [submitError, setSubmitError]         = useState("");
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [isOffline, setIsOffline]             = useState(!navigator.onLine);
  const [isPartialSuccess, setIsPartialSuccess] = useState(false);
  const [validationTrigger, setValidationTrigger] = useState(0);

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
    const on  = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online",  on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online",  on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const clearSubmitError    = () => setSubmitError("");
  const triggerFormValidation = () => setValidationTrigger((v) => v + 1);

  // FIX: lanza error descriptivo si el bookingId no está en sessionStorage.
  // Antes devolvía 0 silenciosamente → PUT /bookings/0 → 404 sin explicación.
  // Esto puede ocurrir en modo incógnito, tras borrado manual de sessionStorage
  // o si el usuario llega a la pantalla de revisión sin haber pasado por la carga.
  const getBackendIds = () => {
    const rawId   = sessionStorage.getItem(`bookingId_${token}`);
    const bookingId = rawId ? parseInt(rawId, 10) : null;

    if (!bookingId || isNaN(bookingId)) {
      throw new Error(
        "No se pudo identificar la reserva. Por favor, recargue la página o acceda de nuevo mediante el enlace de su reserva.",
      );
    }

    const rawClientId = sessionStorage.getItem(`clientId_${token}`);
    const clientId    = rawClientId ? parseInt(rawClientId, 10) : null;

    return { bookingId, clientId };
  };

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
      // FIX: getBackendIds ahora lanza si bookingId es 0/NaN
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
        guests:        state.guests,
        horaLlegada:   state.horaLlegada,
        observaciones: state.observaciones,
      });

      setIsPartialSuccess(false);

      // Limpiar estado de sesión
      SESSION_KEYS_TO_CLEAR.forEach((key) => sessionStorage.removeItem(key));

      // FIX: limpiar caché de catálogos para que el siguiente usuario
      // (en una tablet de recepción) no reutilice datos de la sesión anterior.
      clearCatalogsCache();

      actions.goTo("exito", "forward");
    } catch (err: unknown) {
      let msg = t("errorBoundary.title");
      if (err instanceof Error)      msg = err.message;
      else if (typeof err === "string") msg = err;
      setSubmitError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit        = () => submitToServer(false);
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