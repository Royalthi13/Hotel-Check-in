import React, { useState } from "react";
import { Button, Field, Alert, Icon } from "@/components/ui";
import { useTranslation } from "react-i18next";

export const ScreenLogin: React.FC<{ onSuccess: () => void }> = ({
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí puedes poner tu lógica real. Por ahora, si es "1234", pasa.
    if (pin === "1234") {
      onSuccess();
    } else {
      setError(t("login.error_incorrect_pin"));
    }
  };

  return (
    <div style={{ padding: "32px", textAlign: "center" }}>
      <div style={{ marginBottom: "24px" }}>
        <Icon name="lock" size={48} color="var(--primary)" />
      </div>
      <h2>{t("login.title")}</h2>
      <p style={{ color: "var(--text-mid)", marginBottom: "24px" }}>
        {t("login.subtitle")}
      </p>

      <form onSubmit={handleSubmit}>
        {error && <Alert variant="err">{error}</Alert>}

        <Field label={t("login.pin_label")}>
          <input
            type="password"
            value={pin}
            onChange={(e) => {
              setPin(e.target.value);
              setError("");
            }}
            placeholder="••••"
            style={{
              width: "100%",
              padding: "12px",
              fontSize: "18px",
              textAlign: "center",
              letterSpacing: "4px",
            }}
            autoFocus
          />
        </Field>

        <div style={{ marginTop: "24px" }}>
          <Button variant="primary" type="submit" disabled={!pin}>
            {t("login.btn_enter")}
          </Button>
        </div>
      </form>
    </div>
  );
};
