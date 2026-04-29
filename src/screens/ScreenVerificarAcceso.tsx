import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Button, Alert, Icon } from "@/components/ui";
import { LanguageSelector } from "../components/LanguageSelector";
import "./ScreenVerificarAcceso.css";

interface Props {
  mode: "email" | "phone";
  expected: string;
  bookingRef: string;
  onSuccess: () => void;
  onTooManyAttempts: () => void;
}

const norm = (s: string) => s.toLowerCase().trim();
const onlyDigits = (s: string) => s.replace(/\D/g, "");

export const ScreenVerificarAcceso: React.FC<Props> = ({
  mode,
  expected,
  bookingRef,
  onSuccess,
  onTooManyAttempts,
}) => {
  const { t } = useTranslation();
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const [attempts, setAttempts] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let ok = false;
    if (mode === "email") {
      ok = !!val.trim() && norm(val) === norm(expected);
    } else {
      const last3Esperado = onlyDigits(expected).slice(-3);
      const last3Introducido = onlyDigits(val).slice(-3);
      ok = last3Esperado.length === 3 && last3Introducido === last3Esperado;
    }
    if (ok) {
      onSuccess();
      return;
    }
    const next = attempts + 1;
    setAttempts(next);
    if (next >= 3) {
      onTooManyAttempts();
      return;
    }
    setErr(t("verification.error_message"));
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
              className={`verify-input ${mode === "email" ? "verify-input--email" : "verify-input--phone"}`}
            />
          </Field>
        </div>

        <div className="spacer verify-spacer" />

        <div className="btn-row verify-btn-wrapper">
          <Button
            variant="primary"
            type="submit"
            iconRight="right"
            disabled={!val.trim()}
            style={{ height: "56px", fontSize: "16px", fontWeight: "600" }}
            className={val.trim() ? "verify-btn-active" : ""}
          >
            {t("verification.button_submit")}
          </Button>
        </div>
      </div>
    </form>
  );
};
