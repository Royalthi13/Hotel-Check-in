import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Alert, Icon } from "@/components/ui";

interface Props {
  numPersonas: number;
  onChange: (total: number) => void;
  onNext: () => void;
  totalFijo?: number;
}

const MAX_TOTAL = 10;

export const ScreenNumPersonas: React.FC<Props> = ({
  numPersonas,
  onChange,
  onNext,
  totalFijo,
}) => {
  const { t } = useTranslation();
  const [error, setError] = useState("");

  const modoReserva = totalFijo !== undefined;
  const total = modoReserva ? totalFijo : numPersonas;
  const personaNoun =
    total === 1
      ? t("guestsCount.person_singular")
      : t("guestsCount.person_plural");

  const setTotal = (n: number) => {
    if (n < 1 || n > MAX_TOTAL) return;
    onChange(n);
  };

  const handleNext = () => {
    if (total < 1) {
      setError(t("validation.min_persons"));
      return;
    }
    setError("");
    onNext();
  };

  return (
    <div >
      <div className="sec-hdr">
        <h2>
          {modoReserva
            ? t("guestsCount.title_booking")
            : t("guestsCount.title_manual")}
        </h2>
        <p>
          {modoReserva
            ? t("guestsCount.subtitle_booking", {
                total: totalFijo,
                noun: personaNoun,
              })
            : t("guestsCount.subtitle_manual")}
        </p>
      </div>

      <div style={{ padding: "0 24px" }}>
        {!modoReserva && (
          <>
            <div className="divlabel">{t("guestsCount.title_manual")}</div>
            <div className="stepper">
              <button
                className="stepper-btn"
                onClick={() => setTotal(total - 1)}
                disabled={total <= 1}
              >
                <Icon name="minus" size={20} />
              </button>
              <div>
                <div className="stepper-value">{total}</div>
                <div className="stepper-label">{personaNoun}</div>
              </div>
              <button
                className="stepper-btn"
                onClick={() => setTotal(total + 1)}
                disabled={total >= MAX_TOTAL}
              >
                <Icon name="plus" size={20} />
              </button>
            </div>
          </>
        )}

        <div
          style={{
            margin: "20px 0 4px",
            padding: "14px 16px",
            background: "var(--bg)",
            borderRadius: 12,
            border: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, color: "var(--text-mid)" }}>
              {t("guestsCount.total", { total, noun: personaNoun })}
            </span>
          </div>
        </div>

        {!modoReserva && total >= MAX_TOTAL && (
          <Alert variant="info" style={{ marginTop: 8 }}>
            {t("guestsCount.max_limit", { max: MAX_TOTAL })}
          </Alert>
        )}

        {error && (
          <Alert variant="err" style={{ marginTop: 8 }}>
            {error}
          </Alert>
        )}
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={handleNext}>
          {t("guestsCount.btn_continue", { total, noun: personaNoun })}
        </Button>
      </div>
    </div>
  );
};
