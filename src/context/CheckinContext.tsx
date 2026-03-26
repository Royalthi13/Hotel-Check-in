import React, { createContext, useContext, useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCheckin } from "@/hooks/useCheckin";
import type { CheckinState, CheckinNav, CheckinActions } from "@/types";

interface CheckinContextValue {
  state: CheckinState;
  nav: CheckinNav;
  actions: CheckinActions;
  isLoading: boolean;
  submitError: string;
  isSubmitting: boolean;
  isOffline: boolean;
  isPartialSuccess: boolean;
  legalPassed: boolean;
  setLegalPassed: React.Dispatch<React.SetStateAction<boolean>>;
  hasMinorsFlag: boolean;
  setHasMinorsFlag: React.Dispatch<React.SetStateAction<boolean>>;
  token: string;
  handleChooseMethod: (method: "scan" | "manual") => void;
  handleSubmit: () => Promise<void>;
  handlePartialSubmit: () => Promise<void>;

  validationTrigger: number;
  triggerFormValidation: () => void;

  clearSubmitError: () => void;
}

const CheckinContext = createContext<CheckinContextValue | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export const useCheckinContext = () => {
  const ctx = useContext(CheckinContext);
  if (!ctx)
    throw new Error(
      "useCheckinContext debe usarse dentro de un CheckinProvider",
    );
  return ctx;
};

export const CheckinProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const { token: urlToken, step } = useParams();
  const token = urlToken || "new";

  const [state, nav, actions, isLoading] = useCheckin(token, step);

  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isPartialSuccess, setIsPartialSuccess] = useState(false);

  const [legalPassed, setLegalPassed] = useState(
    () => sessionStorage.getItem(`legalPassed_${token}`) === "true",
  );
  const [hasMinorsFlag, setHasMinorsFlag] = useState(
    () => sessionStorage.getItem(`hasMinors_${token}`) === "true",
  );

  const [validationTrigger, setValidationTrigger] = useState(0);

  const triggerFormValidation = () => {
    setValidationTrigger((prev) => prev + 1);
  };

  const clearSubmitError = () => {
    setSubmitError("");
  };

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

  const handleChooseMethod = (method: "scan" | "manual") => {
    sessionStorage.setItem(`modoFlujo_${token}`, method);
    actions.setNumPersonas(state.reserva?.numHuespedes || 1);
    if (method === "scan") {
      actions.goTo("escanear", "forward", 0);
    } else {
      actions.goTo("form_personal", "forward", 0);
    }
  };

  const submitToServer = async (isPartial: boolean): Promise<void> => {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const payload = {
        reserva: state.reserva,
        guests: state.guests.map((g) => {
          const copia = { ...g };
          delete copia.docFile;
          return copia;
        }),
        horaLlegada: state.horaLlegada,
        observaciones: state.observaciones,
        isPartial,
      };

      const res = await fetch(`/api/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setIsPartialSuccess(isPartial);

      if (!isPartial) {
        const keysToClear = [
          `state_${token}`,
          `history_${token}`,
          `allowedSteps_${token}`,
          `legalPassed_${token}`,
          `hasMinors_${token}`,
          `modoFlujo_${token}`,
        ];
        keysToClear.forEach((key) => sessionStorage.removeItem(key));
        actions.goTo("exito", "forward");
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("errorBoundary.title");
      setSubmitError(errMsg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => submitToServer(false);
  const handlePartialSubmit = () => submitToServer(true);

  const value: CheckinContextValue = {
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
