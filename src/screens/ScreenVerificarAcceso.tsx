import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Field, Button, Alert, Icon } from "@/components/ui";
import { LanguageSelector } from "../components/LanguageSelector";
import { requestPreCheckinToken } from "@/api/axiosInstance";
import "./ScreenVerificarAcceso.css";

interface Props {
  mode: "email" | "phone";
  bookingRef: string;
  onSuccess: () => void;
}

export const ScreenVerificarAcceso: React.FC<Props> = ({
  mode,
  bookingRef,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const isSessionExpired = searchParams.get("expired") === "true";

  // Claves para el sessionStorage
  const sessionKey = `verify_attempts_${bookingRef}`;
  const blockKey = `verify_block_time_${bookingRef}`;
  const COOLDOWN_MS = 20 * 60 * 1000;

  // 1. Inicializamos el estado de bloqueo comprobando si ya pasó el tiempo
  const [isBlocked, setIsBlocked] = useState(() => {
    const blockStart = sessionStorage.getItem(blockKey);

    if (blockStart) {
      const timePassed = Date.now() - parseInt(blockStart, 10);

      if (timePassed < COOLDOWN_MS) {
        return true; // ❌ Aún no han pasado los 20 mins
      } else {
        // ✅ Ya pasaron los 20 mins. Levantamos el castigo.
        sessionStorage.removeItem(blockKey);
        sessionStorage.removeItem(sessionKey);
        return false;
      }
    }
    return false;
  });

  // 2. Inicializamos el contador de intentos
  const [attempts, setAttempts] = useState(() => {
    const stored = sessionStorage.getItem(sessionKey);
    return stored ? parseInt(stored, 10) : 0;
  });

  // 3. Si entra a la pantalla y ya estaba bloqueado, le mostramos el error directamente
  useEffect(() => {
    if (isBlocked) {
      setErr(t("verification.too_many_attempts"));
    }
  }, [isBlocked, t]);

  // Función auxiliar para aplicar el bloqueo
  const applyBlock = () => {
    setIsBlocked(true);
    sessionStorage.setItem(blockKey, Date.now().toString());
    setErr(t("verification.too_many_attempts"));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlocked) return;

    setErr("");
    setIsLoading(true);

    try {
      const payload = {
        access_code: bookingRef,
        ...(mode === "email"
          ? { email: val.trim() }
          : { phone: val.replace(/\D/g, "") }),
      };

      await requestPreCheckinToken(payload);

      // Éxito: Limpiamos historial de errores y continuamos
      sessionStorage.removeItem(sessionKey);
      sessionStorage.removeItem(blockKey);
      window.history.replaceState({}, document.title, window.location.pathname);
      onSuccess();
    } catch (error: any) {
      const status = error.response?.status;

      if (status === 429) {
        // ❌ Rate Limit del Backend
        applyBlock();
      } else if (status === 401 || status === 403 || status === 404) {
        // ❌ Credenciales incorrectas
        const next = attempts + 1;
        setAttempts(next);
        sessionStorage.setItem(sessionKey, next.toString());

        if (next >= 3) {
          applyBlock(); // Bloqueamos localmente
        } else {
          setErr(t("verification.error_message"));
        }
      } else {
        // ❌ Error de red
        setErr(t("search.error_connection"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const label =
    mode === "email" ? t("forms.email") : t("verification.phone_last3_label");

  const placeholder = mode === "email" ? t("forms.email_placeholder") : "•••";

  return (
    <form onSubmit={handleSubmit} className="screen verify-screen">
      <div className="tablet-hero verify-hero">
        <div className="verify-lang-wrapper">
          <LanguageSelector />
        </div>

        <div className="tablet-big-icon">
          <Icon name="lock" size={28} color="var(--primary)" />
        </div>

        <h1 className="tablet-title verify-title-margin">
          {t("verification.title")}
        </h1>

        <p className="tablet-sub verify-sub-opacity">
          {t("verification.booking_label")}:{" "}
          <strong className="verify-sub-strong">{bookingRef}</strong>
        </p>
      </div>

      <div className="verify-card">
        <div className="verify-content">
          <p className="verify-instruction">
            {mode === "email"
              ? t("verification.instruction_email")
              : t("verification.instruction_phone")}
          </p>

          {isSessionExpired && !err && (
            <Alert variant="err" style={{ marginBottom: "16px" }}>
              {t("auth.session_expired")}
            </Alert>
          )}

          {err && <Alert variant="err">{err}</Alert>}

          <Field label={label} required>
            <input
              type={mode === "email" ? "email" : "tel"}
              inputMode={mode === "email" ? "email" : "numeric"}
              value={val}
              onChange={(e) => {
                setVal(
                  mode === "phone"
                    ? e.target.value.replace(/\D/g, "").slice(0, 3)
                    : e.target.value,
                );
                setErr("");
              }}
              placeholder={placeholder}
              maxLength={mode === "phone" ? 3 : undefined}
              autoFocus
              disabled={isLoading || isBlocked}
              className={`verify-input ${mode === "email" ? "verify-input--email" : "verify-input--phone"} ${isBlocked ? "opacity-50" : ""}`}
            />
          </Field>
        </div>

        <div className="spacer verify-spacer" />

        <div className="btn-row verify-btn-wrapper">
          <Button
            variant="primary"
            type="submit"
            iconRight="right"
            disabled={!val.trim() || isLoading || isBlocked}
            style={{ height: "56px", fontSize: "16px", fontWeight: "600" }}
            className={val.trim() && !isBlocked ? "verify-btn-active" : ""}
          >
            {isLoading ? t("common.loading") : t("verification.button_submit")}
          </Button>
        </div>
      </div>
    </form>
  );
};
