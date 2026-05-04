import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Button, Alert, Icon } from "@/components/ui";
import { LanguageSelector } from "../components/LanguageSelector";
import { requestPreCheckinToken } from "@/api/auth.service";
import "./ScreenVerificarAcceso.css";

interface Props {
  accessCode: string;
  bookingRef: string;
  onSuccess: () => void;
  onTooManyAttempts: () => void;
}

export const ScreenVerificarAcceso: React.FC<Props> = ({
  accessCode,
  bookingRef,
  onSuccess,
  onTooManyAttempts,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [val, setVal] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!val.trim() || loading) return;

    setLoading(true);
    setErr("");

    try {
      const trimmed = val.trim();
      await requestPreCheckinToken(
        accessCode,
        mode === "email" ? trimmed : undefined,
        mode === "phone" ? trimmed : undefined,
      );
      onSuccess();
    } catch (e: unknown) {
      const error = e as Error & { status?: number };
      if (error.status === 429) {
        onTooManyAttempts();
        return;
      }
      setErr(t("verification.error_message"));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: "email" | "phone") => {
    setMode(next);
    setVal("");
    setErr("");
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
              className={`verify-input ${
                mode === "email" ? "verify-input--email" : "verify-input--phone"
              }`}
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
            disabled={!val.trim() || loading}
            style={{ height: "56px", fontSize: "16px", fontWeight: "600" }}
            className={val.trim() ? "verify-btn-active" : ""}
          >
            {loading ? t("common.loading") : t("verification.button_submit")}
          </Button>
        </div>
      </div>
    </form>
  );
};