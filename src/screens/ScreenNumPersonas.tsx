import React, { useState } from "react";
import { useTranslation } from "react-i18next"; // 1. Importar hook
import { Button, Alert, Icon } from "@/components/ui";

interface Props {
  numAdultos: number;
  numMenores: number;
  onChange: (adultos: number, menores: number) => void;
  onNext: () => void;
  totalFijo?: number;
}

const MAX_TOTAL = 10;

export const ScreenNumPersonas: React.FC<Props> = ({
  numAdultos,
  numMenores,
  onChange,
  onNext,
  totalFijo,
}) => {
  const { t } = useTranslation(); // 2. Inicializar traductor
  const [error, setError] = useState("");

  // ── Modo con backend: total conocido, solo preguntamos menores ────────────
  const modoReserva = totalFijo !== undefined;
  const total = modoReserva ? totalFijo : numAdultos + numMenores;
  const maxMenores = modoReserva ? totalFijo - 1 : MAX_TOTAL - numAdultos;
  const adultosCount = modoReserva ? totalFijo - numMenores : numAdultos;

  // Variables auxiliares para los plurales
  const personaNoun =
    total === 1
      ? t("guestsCount.person_singular")
      : t("guestsCount.person_plural");
  const personaNounFijo =
    totalFijo === 1
      ? t("guestsCount.person_singular")
      : t("guestsCount.person_plural");
  const adultoNoun =
    adultosCount === 1
      ? t("guestsCount.adult_singular")
      : t("guestsCount.adult_plural");
  const menorNoun =
    numMenores === 1
      ? t("guestsCount.minor_singular")
      : t("guestsCount.minor_plural");

  const setMenores = (n: number) => {
    if (n < 0 || n > maxMenores) return;
    const adultos = totalFijo !== undefined ? totalFijo - n : numAdultos;
    onChange(adultos, n);
  };

  const setAdultos = (n: number) => {
    if (n < 1 || n + numMenores > MAX_TOTAL) return;
    onChange(n, numMenores);
  };

  const handleNext = () => {
    if (!modoReserva && numAdultos < 1) {
      setError(t("validation.min_adults"));
      return;
    }
    if (modoReserva && totalFijo - numMenores < 1) {
      setError(t("validation.min_adults_booking"));
      return;
    }
    setError("");
    onNext();
  };

  return (
    <div className="screen">
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
                noun: personaNounFijo,
              })
            : t("guestsCount.subtitle_manual")}
        </p>
      </div>

      <div style={{ padding: "0 24px" }}>
        {/* ── Modo SIN backend: dos steppers ── */}
        {!modoReserva && (
          <>
            <div className="divlabel">{t("guestsCount.label_adults")}</div>
            <div className="stepper">
              <button
                className="stepper-btn"
                onClick={() => setAdultos(numAdultos - 1)}
                disabled={numAdultos <= 1}
                aria-label="Reducir adultos"
              >
                <Icon name="minus" size={20} />
              </button>
              <div>
                <div className="stepper-value">{numAdultos}</div>
                <div className="stepper-label">
                  {numAdultos === 1
                    ? t("guestsCount.adult_singular")
                    : t("guestsCount.adult_plural")}
                </div>
              </div>
              <button
                className="stepper-btn"
                onClick={() => setAdultos(numAdultos + 1)}
                disabled={numAdultos + numMenores >= MAX_TOTAL}
                aria-label="Aumentar adultos"
              >
                <Icon name="plus" size={20} />
              </button>
            </div>
          </>
        )}

        {/* ── Stepper de menores — siempre visible ── */}
        <div className="divlabel" style={{ marginTop: modoReserva ? 0 : 20 }}>
          {t("guestsCount.label_minors")}
        </div>
        <div className="stepper">
          <button
            className="stepper-btn"
            onClick={() => setMenores(numMenores - 1)}
            disabled={numMenores <= 0}
            aria-label="Reducir menores"
          >
            <Icon name="minus" size={20} />
          </button>
          <div>
            <div className="stepper-value">{numMenores}</div>
            <div className="stepper-label">{menorNoun}</div>
          </div>
          <button
            className="stepper-btn"
            onClick={() => setMenores(numMenores + 1)}
            disabled={numMenores >= maxMenores}
            aria-label="Aumentar menores"
          >
            <Icon name="plus" size={20} />
          </button>
        </div>

        {/* ── Resumen ── */}
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
              {adultosCount} {adultoNoun}
              {numMenores > 0 && ` · ${numMenores} ${menorNoun}`}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-low)" }}>
              {t("guestsCount.total", { total, noun: personaNoun })}
            </span>
          </div>
        </div>

        {/* ── Alertas contextuales ── */}
        {!modoReserva && total >= MAX_TOTAL && (
          <Alert variant="info" style={{ marginTop: 8 }}>
            {t("guestsCount.max_limit", { max: MAX_TOTAL })}
          </Alert>
        )}

        {numMenores > 0 && (
          <Alert variant="warm" style={{ marginTop: 8 }}>
            <strong>{t("guestsCount.legal_warning_title")}</strong>{" "}
            {t("guestsCount.legal_warning_text")}
          </Alert>
        )}

        {numMenores > 0 && adultosCount > 1 && (
          <Alert variant="info" style={{ marginTop: 8 }}>
            {t("guestsCount.relation_declaration", {
              minor_noun:
                numMenores === 1
                  ? t("guestsCount.the_minor_singular")
                  : t("guestsCount.the_minor_plural"),
              adults: adultosCount,
            })}
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
