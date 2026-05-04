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
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const isSessionExpired = searchParams.get("expired") === "true";

  const sessionKey = `verify_attempts_${bookingRef}`;
  const blockKey = `verify_block_time_${bookingRef}`;

  const COOLDOWN_MS = 30 * 60 * 1000;

  const [isBlocked, setIsBlocked] = useState(() => {
    const blockStart = sessionStorage.getItem(blockKey);

    if (blockStart) {
      const timePassed = Date.now() - parseInt(blockStart, 10);

      if (timePassed < COOLDOWN_MS) {
        return true;
      } else {
        sessionStorage.removeItem(blockKey);
        sessionStorage.removeItem(sessionKey);
        return false;
      }
    }
    return false;
  });

  const [attempts, setAttempts] = useState(() => {
    const stored = sessionStorage.getItem(sessionKey);
    const parsedAttempts = stored ? parseInt(stored, 10) : 0;

    if (parsedAttempts >= 5) setIsBlocked(true);
    return parsedAttempts;
  });

  useEffect(() => {
    if (isBlocked) {
      setErr(t("verification.too_many_attempts"));
    }
  }, [isBlocked, t]);

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

      sessionStorage.removeItem(sessionKey);
      sessionStorage.removeItem(blockKey);
      window.history.replaceState({}, document.title, window.location.pathname);
      onSuccess();
    } catch (error: any) {
      const status = error.response?.status;

      if (status === 429) {
        applyBlock();
      } else if (status === 401 || status === 403 || status === 404) {
        const next = attempts + 1;
        setAttempts(next);
        sessionStorage.setItem(sessionKey, next.toString());

        if (next >= 5) {
          applyBlock();
        } else {
          setErr(t("verification.error_message"));
        }
      } else {
        setErr(t("search.error_connection"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const label =
    mode === "email" ? t("forms.email") : t("verification.phone_last3_label");
  const placeholder =
    mode === "email" ? t("forms.email_placeholder") : "612 345 678";

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
              inputMode={mode === "email" ? "email" : "tel"}
              value={val}
              onChange={(e) => {
                setVal(e.target.value);
                setErr("");
              }}
              placeholder={placeholder}
              autoFocus
              disabled={isLoading || isBlocked}
              className={`verify-input ${mode === "email" ? "verify-input--email" : "verify-input--phone"} ${isBlocked ? "opacity-50" : ""}`}
            />
          </Field>

          <button
            type="button"
            onClick={() => switchMode(mode === "email" ? "phone" : "email")}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary)",
              fontSize: 13,
              cursor: "pointer",
              marginTop: 12,
              padding: "8px 4px",
              textDecoration: "underline",
              fontFamily: "inherit",
            }}
          >
            {mode === "email"
              ? t("verification.switch_to_phone")
              : t("verification.switch_to_email")}
          </button>
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
